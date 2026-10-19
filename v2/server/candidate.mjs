import {han} from './store.mjs';

// Reading a saved candidate never invokes the provider or changes the original.
export function candidate(st) {
 let response;try {response=JSON.parse(st.raw);} catch {return null;}
 const choice=response.choices?.[0],text=choice?.message?.content;
 if(typeof text!=='string'||!text.trim())return null;
 return {text,words:han(text),finishReason:choice.finish_reason||null,
  canRegenerate:st.phase==='draft'&&st.status==='rejected'&&st.data.httpStatus===200&&st.data.partial===false&&choice.finish_reason==='stop'};
}
