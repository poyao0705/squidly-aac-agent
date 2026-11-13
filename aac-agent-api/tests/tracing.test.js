import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function initializeTracing(publicKey, secretKey) {
	const result = spawnSync(
		process.execPath,
		[
			"--import", "tsx", "--input-type=module", "--eval",
			`
				import * as agents from "@openai/agents";
				agents.setTracingDisabled(false);
				const { sdk } = await import("./src/utils/tracing.ts");
				try {
					const trace = agents.getGlobalTraceProvider().createTrace({
						name: "optional tracing test",
					});
					console.log(JSON.stringify({
						hasSdk: sdk !== undefined,
						isNoopTrace: trace instanceof agents.NoopTrace,
					}));
				} finally {
					await sdk?.shutdown();
				}
			`,
		],
		{
			cwd: new URL("../", import.meta.url),
			env: {
				...process.env,
				LANGFUSE_PUBLIC_KEY: publicKey,
				LANGFUSE_SECRET_KEY: secretKey,
				OTEL_SDK_DISABLED: "false",
			},
			encoding: "utf8",
			timeout: 10_000,
		},
	);

	assert.ifError(result.error);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
	return JSON.parse(result.stdout);
}

for (const [name, publicKey, secretKey] of [
	["missing credentials", undefined, undefined],
	["missing public key", undefined, "sk-lf-test"],
	["missing secret key", "pk-lf-test", undefined],
	["empty credentials", "", ""],
	["blank public key", " \t ", "sk-lf-test"],
	["blank secret key", "pk-lf-test", " \t "],
	["blank credentials", " \t ", " \t "],
]) {
	test(`tracing is disabled with ${name}`, () => {
		assert.deepEqual(initializeTracing(publicKey, secretKey), {
			hasSdk: false,
			isNoopTrace: true,
		});
	});
}

test("tracing is enabled when both Langfuse keys are provided", () => {
	assert.deepEqual(initializeTracing("pk-lf-test", "sk-lf-test"), {
		hasSdk: true,
		isNoopTrace: false,
	});
});
