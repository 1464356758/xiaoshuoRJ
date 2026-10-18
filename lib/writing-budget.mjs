import {count} from './quality.mjs';

// Adapt later scenes to the actual saved word count. Never cut saved prose or
// omit a scene to meet the length target; the complete chapter is still audited.
export function fragmentWordBudget(book,chapter) {
  const scenes=Math.max(1,chapter.contract?.scenes?.length||1);
  const remainingScenes=Math.max(1,scenes-(chapter.chunks?.length||0));
  const nominal=Math.ceil(book.targetWords/scenes);
  const savedWords=count(chapter.content||(chapter.chunks||[]).join('\n\n'));
  const remainingWords=book.targetWords-savedWords;
  const target=Math.max(Math.ceil(nominal*.6),Math.min(Math.ceil(nominal*1.4),Math.ceil(remainingWords/remainingScenes)));
  return {target,savedWords,remainingWords,remainingScenes};
}
