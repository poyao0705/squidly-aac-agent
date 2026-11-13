// import { observeOpenAI } from "@langfuse/openai";
// import { LangfuseSpanProcessor } from "@langfuse/otel";
// import { setDefaultOpenAIClient } from "@openai/agents";
// import { NodeSDK } from "@opentelemetry/sdk-node";
// import OpenAI from "openai";
//
// export const tracingSdk = new NodeSDK({
// 	spanProcessors: [new LangfuseSpanProcessor()],
// });
//
// // Start OpenTelemetry
// tracingSdk.start();
//
// // Configure the default client for the entire Agents SDK
// setDefaultOpenAIClient(observeOpenAI(new OpenAI()));

import { OpenAIAgentsInstrumentation } from "@arizeai/openinference-instrumentation-openai-agents";
import { isDefaultExportSpan, LangfuseSpanProcessor } from "@langfuse/otel";
import * as agents from "@openai/agents";
import { NodeSDK } from "@opentelemetry/sdk-node";

const tracingEnabled = Boolean(
	process.env.LANGFUSE_PUBLIC_KEY?.trim() &&
		process.env.LANGFUSE_SECRET_KEY?.trim(),
);

export let sdk: NodeSDK | undefined;

if (tracingEnabled) {
	// 1. Configure OpenTelemetry to export spans to Langfuse
	sdk = new NodeSDK({
		spanProcessors: [
			new LangfuseSpanProcessor({
				shouldExportSpan: ({ otelSpan }) =>
					isDefaultExportSpan(otelSpan) ||
					otelSpan.instrumentationScope.name.startsWith("@arizeai/openinference"),
			}),
		],
	});

	sdk.start();

	// 2. Bridge OpenAI Agents SDK tracing to OpenTelemetry
	const instrumentation = new OpenAIAgentsInstrumentation();
	instrumentation.manuallyInstrument(agents);
} else {
	agents.setTracingDisabled(true);
}
