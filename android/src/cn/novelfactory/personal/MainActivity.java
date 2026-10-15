package cn.novelfactory.personal;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.List;

/** Personal installed client. Browser-owned sign-in stays in the trusted browser.
 * No service token, API key, visitor cookie, manuscript or password is embedded. */
public final class MainActivity extends Activity {
  private static final String ORIGIN="https://ai-novel-factory.qq1464356758.chatgpt.site";
  private final int green=Color.rgb(32,78,67),ink=Color.rgb(30,45,39),muted=Color.rgb(100,115,107);
  private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    getWindow().setStatusBarColor(Color.rgb(247,248,243));
    getWindow().setNavigationBarColor(Color.rgb(247,248,243));
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
    ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(Color.rgb(247,248,243));
    LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(dp(26),dp(38),dp(26),dp(32));scroll.addView(root);
    ImageView icon=new ImageView(this);icon.setImageResource(R.drawable.ic_launcher);icon.setContentDescription("小说工厂");
    LinearLayout.LayoutParams image=new LinearLayout.LayoutParams(dp(70),dp(70));image.bottomMargin=dp(24);root.addView(icon,image);
    text(root,"小说工厂",32,ink,true,10);
    text(root,"个人专用 · 云端创作",15,green,true,28);
    text(root,"把一个好故事，\n写成值得继续读的作品。",25,ink,true,18);
    text(root,"规划、写作、正式审核和版本保存，继续使用你的私有工作台。",15,muted,false,30);
    button(root,"进入我的工作台","dashboard",true);
    button(root,"开篇验收与投稿","acceptance",false);
    button(root,"模型与费用设置","settings",false);
    button(root,"使用教程与备份说明","guide",false);
    text(root,"仅本人账户可进入",14,green,true,8);
    text(root,"使用原来的 ChatGPT 账户登录。所有模型密钥只在私有工作台中配置，安装包不包含访问凭据。",13,muted,false,16);
    text(root,"这是可独立安装的安卓客户端，工作台由安全浏览器内核承载，创作与同步需要联网。后台是否运行以工作台的任务和调度状态为准。",12,muted,false,16);
    text(root,"V0.4.0 · 签约及保底以平台审核和有效合同为准",11,muted,false,0);
    setContentView(scroll);
  }
  private void text(LinearLayout root,String content,int sp,int color,boolean bold,int bottom){
    TextView v=new TextView(this);v.setText(content);v.setTextSize(sp);v.setTextColor(color);v.setLineSpacing(dp(3),1);
    if(bold)v.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));
    LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(bottom);root.addView(v,p);
  }
  private void button(LinearLayout root,String label,final String view,boolean primary){
    Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setTextSize(16);b.setTextColor(primary?Color.WHITE:green);
    GradientDrawable bg=new GradientDrawable();bg.setColor(primary?green:Color.WHITE);bg.setCornerRadius(dp(15));
    if(!primary)bg.setStroke(dp(1),Color.rgb(216,225,216));b.setBackground(bg);b.setElevation(primary?dp(2):0);
    LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(56));p.bottomMargin=dp(primary?14:10);root.addView(b,p);
    b.setOnClickListener(new View.OnClickListener(){@Override public void onClick(View v){openWorkspace(view);}});
  }
  private void openWorkspace(String view){
    if(!("dashboard".equals(view)||"acceptance".equals(view)||"settings".equals(view)||"guide".equals(view)))return;
    Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(ORIGIN+"/?view="+view));
    Bundle extras=new Bundle();extras.putBinder("android.support.customtabs.extra.SESSION",null);intent.putExtras(extras);
    intent.putExtra("android.support.customtabs.extra.TOOLBAR_COLOR",green);
    intent.putExtra("android.support.customtabs.extra.TITLE_VISIBILITY",1);
    intent.putExtra("android.support.customtabs.extra.ENABLE_URLBAR_HIDING",false);
    List<ResolveInfo> browsers=getPackageManager().queryIntentServices(new Intent("android.support.customtabs.action.CustomTabsService"),0);
    ResolveInfo preferred=getPackageManager().resolveActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(ORIGIN)),0);
    if(preferred!=null&&preferred.activityInfo!=null)for(ResolveInfo browser:browsers)if(browser.serviceInfo.packageName.equals(preferred.activityInfo.packageName)){intent.setPackage(browser.serviceInfo.packageName);break;}
    try{startActivity(intent);}catch(ActivityNotFoundException e){
      intent.setPackage(null);
      try{startActivity(intent);}catch(ActivityNotFoundException missing){new AlertDialog.Builder(this).setTitle("需要浏览器").setMessage("请安装或启用你信任的浏览器，再进入私有工作台。").setPositiveButton("知道了",null).show();}
    }
  }
}
