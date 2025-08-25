# Python-from-Next Debug & Fix Checklist (single snippet)

> Goal: Identify why the Python script exits with code 1 (silent) when spawned from a Next.js API route, and make it reliable.

## 0) Prep a writable debug folder
- [ ] Create `<repo>/tmp` (gitignored) to collect logs/artifacts.
- [ ] Ensure the Next.js process has write permissions to this folder.

## 1) Force Node runtime & keep the route alive
- [ ] In `/api/automation/test/[id]/route.ts`, add at top (no conditionals):
      export const runtime = 'nodejs';
      export const dynamic = 'force-dynamic';
- [ ] Ensure the handler **awaits** the Python process completion before returning a `Response`. Do not return early or stream the response until the child is done.

## 2) Use the exact Python interpreter (no PATH ambiguity)
- [ ] Determine the intended interpreter path:
      • If using a venv: `<repo>/.venv/bin/python` (Linux/macOS) or `.\.venv\Scripts\python.exe` (Windows)
      • Otherwise: the absolute path printed by `which python3` (in the terminal context where it works)
- [ ] In the Node script executor, replace `'python3'` with that absolute path.
- [ ] In the Python script (Step 4 shim), log `sys.executable` to confirm the interpreter used.

## 3) Harden the Node-side runner (capture everything)
- [ ] Replace the current spawn wrapper with a Promise-based helper that captures stdout/stderr fully and never returns early. Example:
      import { spawn } from 'node:child_process';

      export async function runPython({
        pythonPath,
        scriptPath,
        args = [],
        env = {},
        cwd,
      }: {
        pythonPath: string;
        scriptPath: string;
        args?: string[];
        env?: Record<string, string | undefined>;
        cwd: string;
      }) {
        return await new Promise<{code:number|null;signal:NodeJS.Signals|null;stdout:string;stderr:string}>((resolve, reject) => {
          const child = spawn(pythonPath, [scriptPath, ...args], {
            cwd,
            env: {
              ...process.env,
              PYTHONUNBUFFERED: '1',
              PYTHONFAULTHANDLER: '1',
              PYTHONTRACEBACK: '1',
              PYTHONWARNINGS: 'default',
              ...env,
            },
          });

          let stdout = '';
          let stderr = '';

          child.stdout.setEncoding('utf8');
          child.stderr.setEncoding('utf8');

          child.stdout.on('data', (d) => (stdout += d));
          child.stderr.on('data', (d) => (stderr += d));
          child.on('error', reject);
          child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
        });
      }
- [ ] In the API route, write `stdout`/`stderr` to files under `tmp/` for each run, e.g.:
      tmp/py_stdout_<executionId>.log
      tmp/py_stderr_<executionId>.log
- [ ] For one diagnostic run, prepend `['-X','dev']` to the Python args (more verbose exceptions). Optionally test `['-v']` (very verbose imports).

## 4) Add a Python “panic logger” at the very top (before any other imports)
- [ ] Insert this block at line 1 of the Python entry script:
      # --- BEGIN NEXTJS DEBUG SHIM ---
      import os, sys, json, time, traceback
      _ts = str(int(time.time()*1000))
      _log_dir = os.path.join(os.getcwd(), "tmp")
      os.makedirs(_log_dir, exist_ok=True)
      _log_path = os.path.join(_log_dir, f"_pydebug_{_ts}.log")
      try:
          with open(_log_path, "w", buffering=1) as f:
              f.write("[start]\n")
              f.write("argv=" + json.dumps(sys.argv) + "\n")
              f.write("executable=" + sys.executable + "\n")
              f.write("version=" + sys.version + "\n")
              f.write("cwd=" + os.getcwd() + "\n")
              keys = ["PATH","PYTHONPATH","VIRTUAL_ENV","OUTPUT_PATH","EXECUTION_ID","ENV","NODE_ENV","DATABASE_URL"]
              env_dump = {k: os.environ.get(k) for k in keys}
              f.write("env_subset=" + json.dumps(env_dump) + "\n")
      except Exception:
          pass
      # --- END NEXTJS DEBUG SHIM ---
- [ ] Wrap the initial import block to log full tracebacks if imports fail, then re-raise:
      try:
          from basic_capabilities.internal_db_queries_toolbox import push_csv_queries
      except Exception:
          with open(_log_path, "a", buffering=1) as f:
              f.write("[import_exception]\n")
              f.write(traceback.format_exc() + "\n")
          raise

## 5) Arg parsing sanity check
- [ ] Log `sys.argv` (already done by the shim). Confirm your flag is `--dry_run` (underscore) if argparse expects that.
- [ ] If argparse enforces required env/flags, log each precondition and the decision path before any `sys.exit(...)`.

## 6) PYTHONPATH & stdlib shadowing test
- [ ] In the Node env passed to `spawn`, **do not set** `PYTHONPATH` for now. (Remove any `PYTHONPATH: projectRoot` you were injecting.)
- [ ] Inside the Python script, add (after the shim, before other imports):
      import sys, os
      repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))  # adjust as needed
      if repo_root not in sys.path:
          sys.path.insert(0, repo_root)
- [ ] Search the repo for files that could shadow stdlib modules (rename or fix package structure if found):
      logging.py, csv.py, argparse.py, typing.py, dataclasses.py, json.py, time.py, traceback.py, etc.

## 7) Interpreter & dependency validation
- [ ] From the Python shim, confirm `sys.version` and `sys.executable` are the expected ones.
- [ ] From the API route (Node), also write the result of `which python3` to `tmp/which_python3.txt`.
- [ ] Ensure all required 3P packages for the chosen interpreter are installed (`pip show psycopg2-binary` or equivalent). If using a venv, install into that venv specifically.

## 8) Minimal reproducer (bisect imports)
- [ ] Add `scripts/repro_step0.py` (only parse args and exit 0):
      import argparse; p=argparse.ArgumentParser()
      p.add_argument("--dry_run", action="store_true"); p.parse_args()
      print("OK step0")
- [ ] Add `scripts/repro_step1.py` (import your top-level package but no DB calls), then print "OK step1".
- [ ] Progressively add the next most-suspect import (e.g., `psycopg2` or `basic_capabilities.internal_db_queries_toolbox`) until a step fails.
- [ ] Record the exact step where it flips from success to failure.

## 9) File/logging permissions check
- [ ] If the script configures Python logging to a file, verify the target directory exists and is writable by the Next process.
- [ ] Temporarily redirect Python logging to `stdout` (basicConfig with `stream=sys.stdout`) to ensure visibility in captured output.

## 10) Alternative process runners (diagnostic)
- [ ] Try `execFile` instead of `spawn` with the same args to see if behavior differs.
- [ ] Optionally test with `execa` (dev-only) for clearer errors and stack traces.

## 11) Route stability & deployment posture
- [ ] If deploying to Vercel/serverless, confirm this route is **Node.js runtime** (not Edge).
- [ ] For reliability/longer work, consider offloading to a worker:
      • API route enqueues a job (BullMQ/Redis)
      • A dedicated Node worker runs the Python process with stable env
      • API returns immediately; clients poll job status

## 12) Produce an environment diff (Next route vs. standalone Node)
- [ ] From the Next route, write a filtered `process.env` to `tmp/env_next.json`:
      const keys = ["PATH","PYTHONPATH","VIRTUAL_ENV","ENV","NODE_ENV","DATABASE_URL"];
      const envNext = Object.fromEntries(keys.map(k => [k, process.env[k]]));
      await fs.promises.writeFile("tmp/env_next.json", JSON.stringify(envNext, null, 2));
- [ ] From the standalone Node runner (the one that works), write the same filter to `tmp/env_node.json`.
- [ ] Diff the two files and investigate differences relevant to Python, DB, locale, PATH, or logging.

## 13) Success criteria (definition of done)
- [ ] We can reproduce a traceback or explicit error cause in `tmp/_pydebug_*.log` or captured stderr.
- [ ] The failing component is pinned (specific import/config/path).
- [ ] The API route reliably completes for both `--dry_run` and live runs, returning captured output and code 0.