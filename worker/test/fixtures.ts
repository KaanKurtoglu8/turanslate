import type { TranslationResult } from '../../shared/api';

/** A structurally valid model result (the text itself is illustrative). */
export function sampleResult(detectedSource = 'kk'): TranslationResult {
  return {
    detectedSource: detectedSource as TranslationResult['detectedSource'],
    translations: {
      tr: { latin: 'Bugün hava çok güzel.' },
      az: { latin: 'Bu gün hava çox gözäldir.' },
      tk: { latin: 'Şu gün howa örän gowy.' },
      uz: { latin: 'Bugun havo juda yaxşi.' },
      ug: { latin: 'Bügün hawa intayin yaxşi.', native: 'بۈگۈن ھاۋا ئىنتايىن ياخشى.' },
      ky: { latin: 'Bügün aba ırayı abdan cakşı.', native: 'Бүгүн аба ырайы абдан жакшы.' },
      kk: { latin: 'Bügin awa rayı öte jaqsı.', native: 'Бүгін ауа райы өте жақсы.' },
      tt: { latin: 'Bügen hawa bik yaxşı.', native: 'Бүген һава бик яхшы.' },
    },
    common: { latin: 'Bügün hava öte yaxşı.' },
  };
}

/** Shape of an OpenAI Responses API body carrying `payload` as structured output. */
export function openAiBody(payload: unknown, usage = { input: 1000, output: 500 }) {
  return {
    id: 'resp_test',
    object: 'response',
    status: 'completed',
    output: [
      { type: 'reasoning', id: 'rs_1', summary: [] },
      {
        type: 'message',
        id: 'msg_1',
        role: 'assistant',
        content: [{ type: 'output_text', text: JSON.stringify(payload), annotations: [] }],
      },
    ],
    usage: {
      input_tokens: usage.input,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: usage.output,
      output_tokens_details: { reasoning_tokens: 120 },
      total_tokens: usage.input + usage.output,
    },
  };
}
