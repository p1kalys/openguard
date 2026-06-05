import { Tracer } from '../src/tracing/index.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runDemo() {
  const tracer = new Tracer({ maxCompletedTraces: 50 });

  // Simulate first request
  const ctx1 = tracer.start('demo-1', { user: 'alice' });
  const p1 = ctx1.startSpan('Build prompt', 'prompt');
  p1.addEvent('render.prompt');
  p1.end();
  ctx1.endSpan(p1.spanId);

  const provider1 = ctx1.startSpan('Call Provider', 'provider');
  provider1.setAttribute('model', 'gpt-demo-1');
  await sleep(10);
  const retry1 = ctx1.startSpan('Retry #1', 'retry');
  await sleep(5);
  retry1.addEvent('retry.backoff');
  retry1.end('ok');
  ctx1.endSpan(retry1.spanId);

  provider1.addEvent('response.received');
  provider1.end();
  ctx1.endSpan(provider1.spanId);

  ctx1.setProvider({ name: 'openai', model: 'gpt-demo-1', attempts: 2, tokens: { prompt: 5, completion: 20, total: 25 } });
  const trace1 = tracer.finish(ctx1.traceId);
  console.log('--- Trace 1 ---');
  console.log(JSON.stringify(trace1, null, 2));

  // Simulate second concurrent-ish request
  const ctx2 = tracer.start('demo-2', { user: 'bob' });
  const rootChild = ctx2.startSpan('Normalize', 'normalization');
  rootChild.addEvent('normalize.tokens');
  await sleep(2);
  rootChild.end('ok');
  ctx2.endSpan(rootChild.spanId);

  const provider2 = ctx2.startSpan('Call Provider', 'provider');
  provider2.setAttribute('model', 'gpt-demo-2');
  await sleep(7);
  provider2.end('ok');
  ctx2.endSpan(provider2.spanId);

  ctx2.setProvider({ name: 'anthropic', model: 'claude-mini', attempts: 1, tokens: { prompt: 8, completion: 12, total: 20 } });
  const trace2 = tracer.finish(ctx2.traceId);
  console.log('--- Trace 2 ---');
  console.log(JSON.stringify(trace2, null, 2));

  console.log('\nCompleted traces stored (count):', tracer.listCompleted().length);
}

runDemo().catch((e) => {
  console.error('Demo failed', e);
  process.exit(1);
});
