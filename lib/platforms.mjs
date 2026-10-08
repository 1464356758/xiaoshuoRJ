// Verified sources are snapshots, never an assertion of current contract eligibility.
const unknown={entry:'待核验',genres:'须按实际征文与读者数据核验',opening:'待核验',benefits:'以官方现行福利及签署合同为准',aiPolicy:'unknown',disclosure:'待核验，不默认允许AI生成正文',exclusive:'合同级别核验',updateCost:'未估算',confidence:0,checkedAt:null,source:null};
export const platforms=[
  {...unknown,name:'番茄小说',source:'https://fanqienovel.com/writer/zone/help/article',checkedAt:'2026-10-08',confidence:.65,entry:'官方作家专区有签约流程说明；签约门槛尚未逐项核实',benefits:'官方帮助说明：签约且满10万有效字次月、当月听读分成≥500元、每日4000或6000有效字等条件影响全勤。保底需具体合同。',opening:'开篇与章节范围须进一步核验',aiPolicy:'unknown'},
  {...unknown,name:'七猫小说',source:'https://zhushou.qimao.com/become-author',checkedAt:'2026-10-08',confidence:.4,entry:'作家助手提供成为作家入口与编辑联系',benefits:'官方入口介绍保底加全勤，具体金额、审核与有效更新条件待核验'},
  {...unknown,name:'起点中文网',source:'https://write.qq.com/'},
  {...unknown,name:'纵横中文网',source:'https://doc.zongheng.com/welfare/zongheng',checkedAt:'2026-10-08',confidence:.3,benefits:'官方福利页覆盖签约分成及奖励；完整获奖条件与合同细节待核验'},
  {...unknown,name:'17K小说网',source:'https://author.17k.com/',checkedAt:'2026-10-08',confidence:.2,entry:'已核验官方作者中心；登录后可新建作品。2026福利公告具体条款待核验'},
  {...unknown,name:'书旗小说',source:'https://write.shuqi.com/'},
  {...unknown,name:'飞卢小说网',source:'https://b.faloo.com/Author/2.html'},
  {...unknown,name:'晋江文学城',source:'https://bbs.jjwxc.net/showmsg.php?board=17&id=2214182',checkedAt:'2026-10-08',confidence:.75,aiPolicy:'restricted',disclosure:'2025-02-17官方试运行公告仅允许校对、零散要素、粗纲辅助，禁止超出范围。本系统自动正文流程不适用。后续规则仍须复核。'},
];
export function platformScore(p,genreFit=50,costFit=50) {
  const age=p.checkedAt?(Date.now()-Date.parse(p.checkedAt))/86400000:999;
  const evidence=Math.round((p.confidence||0)*100*Math.max(0,1-age/90));
  const policy=p.aiPolicy==='allowed'?100:p.aiPolicy==='restricted'?0:20;
  const total=Math.round(evidence*.4+policy*.3+genreFit*.2+costFit*.1);
  return {total,evidence,policy,genreFit,costFit,eligible:p.aiPolicy==='allowed'&&age<30,note:'规则证据40% + AI适配30% + 题材适配20% + 成本适配10%；未知项降权，评分不代表签约概率'};
}
