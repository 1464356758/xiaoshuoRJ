import {advancedNarrative} from './narrative.mjs';
export function planningNarrativePrompt(book) {
  if(!advancedNarrative(book))return '';
  return ' 本书启用高级叙事规格。在上述同一个JSON中补充bible.readerPromise（读者持续追读能获得什么体验）、themeQuestion（人物面对的有张力问题，不写口号）、endingCost（最终选择不可取消的代价）。人物characters每人有唯一ASCII id如C001、唯一name，以及具体goal/desire/weakness/voice/cost/knowledge，不能全员相同动机。foreshadowing必须是数组，可为空；每项{id:唯一ASCII ID如F001,promise:明确读者承诺,plantChapter:埋设章号,dueChapter:最迟兑现章号}，1<=plantChapter<dueChapter<=总章数，最多100项，同一章埋设与最迟兑现任务合计最多40项，应分散安排；不要把普通疑问或每个细节都登记为伏笔。不为凑数量加入承诺。读者承诺不能等同于保证平台签约。';
}
export function contractNarrativePrompt(book) {
  if(!advancedNarrative(book))return '';
  return ' 本书采用高级任务书：以上schema改为3，在同一个JSON增加characterFocus:{characterId:人物档案中已知ID,want:本章具体欲望,dilemma:选择之间的真实取舍}，drama:{conflict:本章冲突类型,method:解决手段,emotion:主要情绪体验}，promiseActions:[{id:已有承诺ID,action:"plant|pay",scene:从1开始的场景号,reason:怎样埋设或兑现}]。memory.narrative.toPlant/toPay列出的到期任务必须逐项覆盖，无行动时为空数组；不改原承诺和期限，不重开已兑现伏笔。焦点人物至少参加一个场景。与最近三章冲突/手段/情绪三项都相同时应先重新设计，不能只换名字或场景。允许安静章节以关系、认知或立场变化推进，不要求每场都反转、受伤或新增伏笔。';
}
export function reviewNarrativePrompt(chapter) {
  if(chapter.contract?.schema!==3)return '';
  return ' 本章需要在上述同一个审核JSON增加characterBeats:[{characterId:档案ID,choice:人物实际选择,consequence:该选择留下的后果或关系/认知变化,quote:实际原文}]，至少覆盖任务书焦点人物，最多8项；不能靠空泛成长评价代替事件。增加antiLoop:{status:"distinct|similar|insufficient|no_prior",reason:判断依据,severity:相似时为minor或major,comparisons:[{chapter:已提供source章号,currentQuote:本章真实原文,pastQuote:该source片段中真实原文,difference:相似或变化的具体机制}]}，最多3个不同旧章。只有实际提供的source可作引用，不能假装读过未提供的整章；没有旧稿使用no_prior和空comparisons，有旧稿可判distinct或similar并至少提供一组真实对照，资料不足可用insufficient并说明缺什么，程序会暂停定位而不让作者付费迎合假引用。相似不等于抄袭。仅报告本章埋设/兑现的状态事件，不重复列出全部活跃伏笔。逐项核验promiseActions：plant对应foreshadowing事件status=open，pay对应paid，每项evidence必须是实际原文；已知ID只报{id,status,evidence}，不得覆盖promise、plantChapter或dueChapter。正文确有新读者承诺时才可用新ID登记open并附promise、dueChapter（未来且不超过全书终章），不能凭空兑现未开启ID；新增承诺不能把未来同一章的必需行动挤过40项。伏笔数组可为空，不为达标临时降低承诺内容。';
}
