'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export default function BookBudget({book,active,busy,onSave}:any){
  const [budget,setBudget]=useState(book.budget);
  useEffect(()=>setBudget(book.budget),[book.id,book.budget]);
  return <section className="card"><h2>当前作品预算 · {book.title}</h2><p>模型调用按本书预算和全局单书上限中的较小值执行。修改预算前先暂停并等待当前检查点保存。</p><div className="form-grid"><label className="field"><span>本书最高费用（元）</span><Input type="number" min="0" max="10000" step="0.01" value={budget} disabled={active||busy} onChange={e=>setBudget(e.target.value===''?'':Number(e.target.value))}/></label></div><Button variant="outline" disabled={active||busy||budget===''||budget===book.budget} onClick={()=>onSave({id:book.id,revision:book.revision,budget:Number(budget)})}>保存本书预算</Button><p className="small-note">预算修改不会开启费用授权，也不会重启已暂停或阻塞的任务。检查后由你重新启动；降低预算不会清除已有费用。</p></section>;
}
