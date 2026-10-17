package cn.novelfactory.personal;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.lang.ref.WeakReference;
import java.util.Collections;
import org.json.JSONObject;

/** One process-owned WebView: UI reattaches without reloading the paid engine. */
public final class AppRuntime {
  static final String ORIGIN="https://appassets.androidplatform.net";
  private static AppRuntime instance;
  final Context context;final Handler main=new Handler(Looper.getMainLooper());final WebView web;final LocalDatabase database;
  volatile boolean running=false,loaded=false;volatile String message="尚未启动任务";private String secret;
  private WeakReference<MainActivity> host=new WeakReference<>(null);
  private final ApiTransport transport;
  static synchronized AppRuntime get(Context c){if(instance==null)instance=new AppRuntime(c.getApplicationContext());return instance;}
  @SuppressLint({"SetJavaScriptEnabled","AddJavascriptInterface"}) private AppRuntime(Context c){
    context=c;database=new LocalDatabase(c);web=new WebView(c);transport=new ApiTransport(main,web);
    WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setSupportMultipleWindows(false);s.setMediaPlaybackRequiresUserGesture(true);s.setGeolocationEnabled(false);
    if(Build.VERSION.SDK_INT>=26)s.setSafeBrowsingEnabled(true);WebView.setWebContentsDebuggingEnabled(false);
    web.addJavascriptInterface(new Bridge(),"NovelNative");
    web.setWebViewClient(new WebViewClient(){
      @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest req){
        Uri u=req.getUrl();if("https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())&&u.getPath()!=null&&u.getPath().startsWith("/assets/")&&!u.getPath().contains("..")){
          String path=u.getPath().substring(8);if(!(path.equals("index.html")||path.equals("app.js")||path.equals("app.css")))return blocked();
          try{String type=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":"text/html";
            return new WebResourceResponse(type,"UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-store"),context.getAssets().open(path));
          }catch(Exception e){return blocked();}
        }return blocked(); // Local WebView never falls through to the network.
      }
      @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){if(req.isForMainFrame())openExternal(req.getUrl().toString());return true;}
      @Override public boolean shouldOverrideUrlLoading(WebView v,String url){openExternal(url);return true;}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){MainActivity a=host.get();if(a==null){callback.onReceiveValue(null);return true;}a.chooseFile(callback,params.getAcceptTypes());return true;}
      @Override public boolean onJsConfirm(WebView v,String url,String text,JsResult result){MainActivity a=host.get();if(a==null){result.cancel();return true;}new AlertDialog.Builder(a).setMessage(text).setPositiveButton("确定",(d,w)->result.confirm()).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
      @Override public boolean onJsAlert(WebView v,String url,String text,JsResult result){MainActivity a=host.get();if(a==null){result.cancel();return true;}new AlertDialog.Builder(a).setMessage(text).setPositiveButton("知道了",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
    });
    web.loadUrl(ORIGIN+"/assets/index.html");
  }
  private WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
  void attach(MainActivity a){host=new WeakReference<>(a);}
  void detach(MainActivity a){if(host.get()==a)host.clear();}
  void tick(){if(loaded&&running)web.evaluateJavascript("globalThis.__novelTick&&globalThis.__novelTick()",null);}
  void pause(String reason){running=false;message=reason;main.post(()->web.evaluateJavascript("globalThis.__novelPauseAll&&globalThis.__novelPauseAll()",null));}
  void openExternal(String address){
    try{Uri u=Uri.parse(address);if(!"https".equals(u.getScheme())||u.getHost()==null||"appassets.androidplatform.net".equals(u.getHost()))return;context.startActivity(new Intent(Intent.ACTION_VIEW,u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}catch(Exception ignored){}
  }
  public final class Bridge {
    @JavascriptInterface public String database(String request){return database.execute(request);}
    @JavascriptInterface public synchronized String runtimeSecret(){try{if(secret==null)secret=DeviceVault.runtimeKey(context);return secret;}catch(Exception e){throw new IllegalStateException("设备保险箱不可用，请保留App数据");}}
    @JavascriptInterface public void http(String id,String address,String method,String headers,String body){transport.request(id,address,method,headers,body);}
    @JavascriptInterface public void cancelHttp(String id){transport.cancel(id);}
    @JavascriptInterface public boolean startRunner(){
      if(running)return true;try{Intent i=new Intent(context,WritingService.class);if(Build.VERSION.SDK_INT>=26)context.startForegroundService(i);else context.startService(i);return true;}catch(Exception e){message="无法启动后台服务，请回到App重试";return false;}
    }
    @JavascriptInterface public boolean isRunning(){return running;}
    @JavascriptInterface public void stopRunner(){running=false;context.stopService(new Intent(context,WritingService.class));}
    @JavascriptInterface public void runnerState(String state){message=state.length()>180?state.substring(0,180):state;if(running)WritingService.refresh(context);}
    @JavascriptInterface public String deviceInfo(){try{return new JSONObject().put("running",running).put("message",message).put("android",Build.VERSION.RELEASE).put("localData",true).put("requiresChatGPT",false).toString();}catch(Exception e){return "{}";}}
    @JavascriptInterface public void ready(){loaded=true;}
    @JavascriptInterface public void copyText(String text){main.post(()->((ClipboardManager)context.getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("小说工厂",text)));}
    @JavascriptInterface public void openExternal(String address){main.post(()->AppRuntime.this.openExternal(address));}
    @JavascriptInterface public void openBatterySettings(){main.post(()->{try{context.startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}catch(Exception ignored){}});}
    @JavascriptInterface public void exportDocument(String name,String type,String base64){
      if(base64.length()>24000000){message="导出超过当前文件上限，请分章导出";return;}
      main.post(()->{MainActivity a=host.get();if(a==null){message="请打开App后重新导出";return;}try{a.saveDocument(name,type,Base64.decode(base64,Base64.DEFAULT));}catch(Exception e){message="导出失败，请重新操作";}});
    }
  }
}
