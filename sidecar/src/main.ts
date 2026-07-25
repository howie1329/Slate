import { runAssist, normalizeAssistError } from "./assist.js";
import { runPlan } from "./plan.js";
import { normalizeProviderError } from "./provider.js";
import {
  assistResponse,
  errorResponse,
  MAX_REQUEST_BYTES,
  parseRequest,
  planResponse,
  type SidecarResponse,
} from "./protocol.js";

const MAX_STDOUT_BYTES = 64 * 1024;

function writeResponse(response: SidecarResponse) {
  const serialized = `${JSON.stringify(response)}\n`;
  if (Buffer.byteLength(serialized, "utf8") > MAX_STDOUT_BYTES) {
    process.exitCode = 1;
    return;
  }

  process.stdout.write(serialized);
}

async function readRequest() {
  const chunks: Buffer[] = [];
  let byteCount = 0;

  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const newlineIndex = bytes.indexOf("\n");
    const lineBytes = newlineIndex === -1 ? bytes : bytes.subarray(0, newlineIndex);

    byteCount += lineBytes.length;
    if (byteCount > MAX_REQUEST_BYTES) {
      throw new Error("Request is too large.");
    }

    chunks.push(lineBytes);
    if (newlineIndex !== -1) {
      return parseRequest(Buffer.concat(chunks, byteCount).toString("utf8"));
    }
  }

  throw new Error("Request must end with a newline.");
}

async function main() {
  let request;
  try {
    request = await readRequest();
  } catch {
    writeResponse(errorResponse("invalid-request"));
    return;
  }

  if (request.operation === "assist") {
    try {
      writeResponse(assistResponse(await runAssist(request)));
    } catch (error) {
      writeResponse(errorResponse(normalizeAssistError(error)));
    }
    return;
  }

  if (request.operation === "plan") {
    try {
      writeResponse(planResponse(await runPlan(request)));
    } catch (error) {
      writeResponse(errorResponse(normalizeProviderError(error)));
    }
    return;
  }

}

void main();
