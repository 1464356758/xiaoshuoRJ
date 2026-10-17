package cn.novelfactory.personal;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

public final class MainActivity extends Activity {
  private final Handler main=new Handler();private final ExecutorService pool=Executors.newFixedThreadPool(2);private final Map<String,HttpsURLConnection> active=new ConcurrentHashMap<>();private final Map<String,Boolean> cancelled=new ConcurrentHashMap<>();
  private WebView web;private volatile JSONObject profile;private volatile boolean closed=false;private ValueCallback<Uri[]> chooser;private byte[] exported;
  @SuppressLint({"SetJavaScriptEnabled","AddJavascriptInterface"}) @Override public void onCreate(Bundle state){
    super.onCreate(state);getWindow().setStatusBarColor(0xfff4f6fa);getWindow().setNavigationBarColor(0xfff4f6fa);getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);profile=CloudVault.read(this);
    web=new WebView(this);WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setSupportMultipleWindows(false);s.setGeolocationEnabled(false);WebView.setWebContentsDebuggingEnabled(false);
    web.addJavascriptInterface(new Bridge(),"NovelCloud");
    web.setWebViewClient(new WebViewClient(){
      @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){Uri u=r.getUrl();String path=u.getPath();if("https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())&&("/assets/index.html".equals(path)||"/assets/app.js".equals(path)||"/assets/app.css".equals(path)))try{return new WebResourceResponse(path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":"text/html","UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-store"),getAssets().open(path.substring(8)));}catch(Exception ignored){}return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
      @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){if(r.isForMainFrame())external(r.getUrl().toString());return true;}
      @Override public boolean shouldOverrideUrlLoading(WebView v,String u){external(u);return true;}
    });
    web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){if(chooser!=null)chooser.onReceiveValue(null);chooser=callback;try{startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"),20);}catch(Exception e){chooser.onReceiveValue(null);chooser=null;}return true;}});
    FrameLayout frame=new FrameLayout(this);frame.setFitsSystemWindows(true);frame.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(frame);web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
  }
  void external(String address){try{Uri u=Uri.parse(address);if("https".equals(u.getScheme())&&u.getHost()!=null&&!"appassets.androidplatform.net".equals(u.getHost()))startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}}
  void result(String id,JSONObject value){final String raw=value.toString();main.post(()->{if(!closed)web.evaluateJavascript("globalThis.__novelCloudResult&&globalThis.__novelCloudResult("+JSONObject.quote(id)+","+JSONObject.quote(raw)+")",null);});}
  void error(String id,String message){try{result(id,new JSONObject().put("error",message));}catch(Exception ignored){}}
  void send(String id,String path,String method,String body,JSONObject credentials,boolean pairing){
    pool.execute(()->{HttpsURLConnection c=null;try{
      if(credentials==null)throw new IllegalArgumentException("请先连接自己的云端服务");if(!CloudPolicy.route(path,method)||body.length()>16000000||cancelled.containsKey(id))throw new IllegalArgumentException("云端请求参数无效或已取消");
      URL u=new URL(CloudPolicy.origin(credentials.getString("origin"))+path);c=(HttpsURLConnection)u.openConnection();active.put(id,c);c.setConnectTimeout(15000);c.setReadTimeout(110000);c.setInstanceFollowRedirects(false);c.setRequestMethod(method);c.setRequestProperty("Authorization","Bearer "+credentials.getString("token"));c.setRequestProperty("Content-Type","application/json");if(!pairing)c.setRequestProperty("X-Novel-Server-Id",credentials.getString("serverId"));
      if(cancelled.containsKey(id))throw new IllegalStateException("请求已取消");
      if("POST".equals(method)){byte[] bytes=body.getBytes(StandardCharsets.UTF_8);c.setDoOutput(true);c.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=c.getOutputStream()){out.write(bytes);}}
      int status=c.getResponseCode();ByteArrayOutputStream bytes=new ByteArrayOutputStream();InputStream response=status>=400?c.getErrorStream():c.getInputStream();if(response!=null)try(InputStream in=response){byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1){if(bytes.size()+n>24000000)throw new IllegalArgumentException("云端响应超过文件上限");bytes.write(b,0,n);}}
      String text=bytes.toString("UTF-8");
      if(pairing&&status==200){JSONObject x=new JSONObject(text);if(!"novel-factory-cloud".equals(x.optString("product"))||x.optInt("protocol")!=1||!x.optString("serverId").matches("[a-f0-9-]{36}"))throw new IllegalArgumentException("此地址不是兼容的小说云端服务");credentials.put("serverId",x.getString("serverId"));CloudVault.save(MainActivity.this,credentials);profile=credentials;}
      else if(!pairing&&status>=200&&status<300&&!credentials.getString("serverId").equals(c.getHeaderField("X-Novel-Server-Id")))throw new IllegalArgumentException("云端身份不匹配，请核对后重新连接");
      result(id,new JSONObject().put("status",status).put("body",text).put("headers",new JSONObject().put("Content-Type",c.getContentType()==null?"application/json":c.getContentType())));
    }catch(IllegalArgumentException e){error(id,e.getMessage());}catch(Exception e){error(id,"手机连接未完成（"+e.getClass().getSimpleName()+"）；未发送暂停指令，请恢复连接后读取云端进度。未自动重试本次操作。");}finally{active.remove(id);cancelled.remove(id);if(c!=null)c.disconnect();}});
  }
  void save(String name,String type,byte[] bytes){if(exported!=null){new AlertDialog.Builder(this).setMessage("请先完成上一次文件导出").setPositiveButton("知道了",null).show();return;}exported=bytes;try{startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(type.startsWith("application/json")?"application/json":"text/plain").putExtra(Intent.EXTRA_TITLE,name.replaceAll("[/\\\\]","_")),21);}catch(Exception e){exported=null;}}
  void legacy(){
    if(!getDatabasePath("novel-factory.sqlite").isFile()){new AlertDialog.Builder(this).setMessage("没有检测到旧本机作品。旧网页作品请在原工作台下载完整备份后导入云端。").setPositiveButton("知道了",null).show();return;}
    try{final List<JSONObject> books;try(LegacyBackup old=new LegacyBackup(this)){books=old.records("book",null);}if(books.isEmpty())throw new IllegalStateException();String[] names=new String[books.size()];for(int i=0;i<names.length;i++)names[i]=books.get(i).optString("title","未命名作品");new AlertDialog.Builder(this).setTitle("导出旧本机作品（不含密钥）").setItems(names,(d,index)->{try(LegacyBackup old=new LegacyBackup(this)){save(names[index]+"_完整备份.json","application/json",old.export(books.get(index)));}catch(Exception e){new AlertDialog.Builder(this).setMessage("旧作品导出未完成，请保留App数据").setPositiveButton("知道了",null).show();}}).show();}catch(Exception e){new AlertDialog.Builder(this).setMessage("未找到可读取的旧作品；原数据未改动").setPositiveButton("知道了",null).show();}
  }
  public final class Bridge {
    @JavascriptInterface public String connectionInfo(){try{JSONObject p=profile;return p==null?"{\"connected\":false}":new JSONObject().put("connected",true).put("origin",p.getString("origin")).put("serverId",p.getString("serverId")).toString();}catch(Exception e){return "{\"connected\":false}";}}
    @JavascriptInterface public void connect(String id,String origin,String token){try{if(!token.matches("[A-Za-z0-9_-]{43}"))throw new IllegalArgumentException("请填写云端连接凭证，不是DeepSeek API Key");send(id,"/api/status","GET","",new JSONObject().put("origin",CloudPolicy.origin(origin)).put("token",token),true);}catch(Exception e){error(id,e.getMessage());}}
    @JavascriptInterface public void request(String id,String path,String method,String body){send(id,path,method,body,profile,false);}
    @JavascriptInterface public void cancelRequest(String id){cancelled.put(id,true);HttpsURLConnection c=active.get(id);if(c!=null)c.disconnect();}
    @JavascriptInterface public void disconnect(){profile=null;CloudVault.clear(MainActivity.this);}
    @JavascriptInterface public void exportDocument(String name,String type,String value){if(value.length()>32000000)return;main.post(()->{try{save(name,type,Base64.decode(value,Base64.DEFAULT));}catch(Exception ignored){}});}
    @JavascriptInterface public void exportLegacy(){main.post(()->legacy());}
    @JavascriptInterface public void openExternal(String url){main.post(()->external(url));}
    @JavascriptInterface public void copyText(String text){main.post(()->((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("小说工厂",text)));}
  }
  @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==20&&chooser!=null){chooser.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);chooser=null;}if(request==21){try{if(result==RESULT_OK&&data!=null&&exported!=null)try(OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(exported);}}catch(Exception e){new AlertDialog.Builder(this).setMessage("保存未完成，请重新导出").setPositiveButton("知道了",null).show();}finally{exported=null;}}}
  @Override public void onBackPressed(){moveTaskToBack(true);}
  @Override public void onDestroy(){closed=true;for(HttpsURLConnection c:active.values())c.disconnect();pool.shutdownNow();if(chooser!=null)chooser.onReceiveValue(null);if(web!=null)web.destroy();super.onDestroy();}
}
