package cn.novelfactory.personal;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.widget.FrameLayout;
import java.io.OutputStream;

public final class MainActivity extends Activity {
  private AppRuntime runtime;private ValueCallback<Uri[]> chooser;private byte[] exportBytes;private FrameLayout frame;
  @Override public void onCreate(Bundle state){
    super.onCreate(state);getWindow().setStatusBarColor(0xfff4f6fa);getWindow().setNavigationBarColor(0xfff4f6fa);getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
    try{
      runtime=AppRuntime.get(this);runtime.attach(this);if(runtime.web.getParent()!=null)((ViewGroup)runtime.web.getParent()).removeView(runtime.web);
      frame=new FrameLayout(this);frame.setFitsSystemWindows(true);frame.addView(runtime.web,new FrameLayout.LayoutParams(-1,-1));setContentView(frame);
      if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},20);
    }catch(Exception e){new AlertDialog.Builder(this).setTitle("无法打开本机引擎").setMessage("请启用或更新系统Android WebView后重新打开。保留App数据，不要卸载。错误："+e.getClass().getSimpleName()).setPositiveButton("关闭",(d,w)->finish()).show();}
  }
  void chooseFile(ValueCallback<Uri[]> callback,String[] types){
    if(chooser!=null)chooser.onReceiveValue(null);chooser=callback;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
    try{startActivityForResult(intent,30);}catch(Exception e){chooser.onReceiveValue(null);chooser=null;}
  }
  void saveDocument(String name,String type,byte[] bytes){
    if(exportBytes!=null){new AlertDialog.Builder(this).setMessage("请先完成上一个导出窗口").setPositiveButton("知道了",null).show();return;}
    exportBytes=bytes;String safe=name.replaceAll("[/\\\\]","_");Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(type.startsWith("application/json")?"application/json":"text/plain").putExtra(Intent.EXTRA_TITLE,safe);
    try{startActivityForResult(intent,31);}catch(Exception e){exportBytes=null;}
  }
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request==30&&chooser!=null){chooser.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);chooser=null;}
    if(request==31){try{if(result==RESULT_OK&&data!=null&&exportBytes!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(exportBytes);}runtime.message="文件已导出";}}catch(Exception e){new AlertDialog.Builder(this).setMessage("保存失败，请重新导出").setPositiveButton("知道了",null).show();}finally{exportBytes=null;}}
  }
  @Override public void onBackPressed(){
    if(runtime!=null&&runtime.running)new AlertDialog.Builder(this).setTitle("返回手机桌面").setMessage("本机任务将尝试继续运行，可从通知栏暂停。系统仍可能结束后台任务。").setPositiveButton("返回桌面",(d,w)->moveTaskToBack(true)).setNegativeButton("留在App",null).show();else moveTaskToBack(true);
  }
  @Override public void onDestroy(){if(chooser!=null){chooser.onReceiveValue(null);chooser=null;}if(runtime!=null){runtime.detach(this);if(runtime.web.getParent()==frame)frame.removeView(runtime.web);}super.onDestroy();}
}
