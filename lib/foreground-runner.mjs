// Invoked only after the owner's explicit Start click. No background auto-resume,
// no retries after an uncertain request, and no independent provider access.
export async function runForegroundBatch({request,onUpdate,shouldContinue,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>Date.now(),maxSteps=80,maxSeconds=1200}) {
  const limit=Math.max(1,Math.min(80,maxSteps)),seconds=Math.max(1,Math.min(1200,maxSeconds));
  const started=now();let steps=0,idle=0;
  while(steps<limit&&now()-started<seconds*1000&&shouldContinue()) {
    const result=await request(); // An error ends this batch; never replay a POST.
    steps++;
    if(shouldContinue())await onUpdate(result);
    if(['completed','paused','blocked'].includes(result.job?.status)||result.reason==='inactive')return {steps,status:result.job?.status||result.reason};
    if(result.advanced)idle=0;
    else if(['waiting','claimed','checkpoint_busy'].includes(result.reason)){
      idle++;if(idle>=6)return {steps,status:'waiting'};if(shouldContinue())await wait(5000);
    }else return {steps,status:result.reason||'stopped'};
  }
  return {steps,status:shouldContinue()?'batch_limit':'stopped'};
}
