"""Compacta um log local; o arquivo de entrada conserva a versão completa."""
import json
import os
import sys
from pathlib import Path

os.environ["HEADROOM_BEACON"] = "off"
os.environ["DO_NOT_TRACK"] = "1"
from headroom import compress

path = Path(sys.argv[1]).resolve()
raw = path.read_bytes()
text = raw.decode("utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig", errors="replace")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
result = compress([
    {"role": "user", "content": "Review the command output; preserve errors and validation results."},
    {"role": "assistant", "content": None, "tool_calls": [{"id": "local-log", "type": "function", "function": {"name": "local_command", "arguments": "{}"}}]},
    {"role": "tool", "tool_call_id": "local-log", "content": text},
])
compressed = "\n".join(m.get("content") or "" for m in result.messages if m.get("role") == "tool")
path.with_suffix(path.suffix + ".headroom.txt").write_text(compressed, encoding="utf-8")
print(json.dumps({"original": str(path), "tokens_before": result.tokens_before, "tokens_after": result.tokens_after, "tokens_saved": result.tokens_saved, "transforms": result.transforms_applied}, ensure_ascii=False))
print(compressed)
