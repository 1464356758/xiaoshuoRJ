package cn.novelfactory.personal;

import android.os.Handler;
import android.webkit.WebView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

final class ApiTransport {
  private final ExecutorService pool=Executors.newFixedThreadPool(2);
  private final Map<String,HttpsURLConnection> active=new ConcurrentHashMap<>();
  private final Map<String,Boolean> cancelled=new ConcurrentHashMap<>();
  private final Handler main;private final WebView web;
  ApiTransport(Handler handler,WebView view){main=handler;web=view;}
  static boolean allowed(URL u,String method){
    if(!"https".equals(u.getProtocol())||u.getUserInfo()!=null||u.getPort()!=-1||u.getRef()!=null)return false;
    String h=u.getHost(),p=u.getPath();
    if("GET".equals(method)){
      if(u.getQuery()!=null)return false;
      if("api.deepseek.com".equals(h)&&"/user/balance".equals(p))return true;
      if("api.github.com".equals(h)&&"/repos/1464356758/xiaoshuoRJ/branches/main".equals(p))return true;
      if("raw.githubusercontent.com".equals(h)){String prefix="/1464356758/xiaoshuoRJ/main/";String[] docs={"README.md","PROJECT_STATUS.md","NEXT_ACTION.md","ARCHITECTURE.md","DEVELOPMENT_LOG.md","docs/USER_GUIDE.md","docs/CLOUD_RUNNER.md","docs/WORKFLOW_V05_REVIEW.md","docs/WORKFLOW_V06_REVIEW.md"};for(String doc:docs)if((prefix+doc).equals(p))return true;}
      return false;
    }
    if(!"POST".equals(method)||u.getQuery()!=null)return false;
    return ("api.deepseek.com".equals(h)&&"/v1/chat/completions".equals(p))
      ||("ark.cn-beijing.volces.com".equals(h)&&"/api/v3/chat/completions".equals(p))
      ||(("dashscope.aliyuncs.com".equals(h)||h.matches("[a-zA-Z0-9-]+\\.dashscope\\.aliyuncs\\.com"))&&"/compatible-mode/v1/chat/completions".equals(p))
      ||("api.openai.com".equals(h)&&"/v1/chat/completions".equals(p))
      ||("openrouter.ai".equals(h)&&"/api/v1/chat/completions".equals(p))
      ||("api.siliconflow.cn".equals(h)&&"/v1/chat/completions".equals(p))
      ||("api.moonshot.cn".equals(h)&&"/v1/chat/completions".equals(p))
      ||("api.groq.com".equals(h)&&"/openai/v1/chat/completions".equals(p));
  }
  void cancel(String id){cancelled.put(id,true);HttpsURLConnection c=active.get(id);if(c!=null)c.disconnect();}
  void request(final String id,final String address,final String method,final String headerJson,final String body){
    pool.execute(()->{
      JSONObject result=new JSONObject();HttpsURLConnection connection=null;
      try{
        URL u=new URL(address);if(!allowed(u,method))throw new IllegalArgumentException("接口地址不在允许列表");
        if(body.length()>16000000||headerJson.length()>16000||cancelled.containsKey(id))throw new IllegalArgumentException("请求已取消或超过上限");
        connection=(HttpsURLConnection)u.openConnection();active.put(id,connection);
        connection.setConnectTimeout(15000);connection.setReadTimeout(100000);connection.setInstanceFollowRedirects(false);connection.setRequestMethod(method);
        JSONObject headers=new JSONObject(headerJson);Iterator<String> keys=headers.keys();while(keys.hasNext()){
          String key=keys.next();if(!key.equalsIgnoreCase("content-type")&&!key.equalsIgnoreCase("authorization")&&!key.equalsIgnoreCase("accept")&&!key.equalsIgnoreCase("user-agent"))throw new IllegalArgumentException("不支持的接口请求头");
          if(key.equalsIgnoreCase("authorization")&&("api.github.com".equals(u.getHost())||"raw.githubusercontent.com".equals(u.getHost())))throw new IllegalArgumentException("公开资料读取不得携带模型密钥");
          connection.setRequestProperty(key,headers.getString(key));
        }
        if(cancelled.containsKey(id))throw new IllegalStateException("请求已取消");
        if("POST".equals(method)){byte[] bytes=body.getBytes(StandardCharsets.UTF_8);connection.setDoOutput(true);connection.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=connection.getOutputStream()){out.write(bytes);}}
        int status=connection.getResponseCode();InputStream input=status>=400?connection.getErrorStream():connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream();
        if(input!=null)try(InputStream in=input){byte[] buffer=new byte[16384];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>8000000)throw new IllegalStateException("响应超过本机上限");out.write(buffer,0,n);}}
        result.put("status",status);result.put("body",out.toString("UTF-8"));result.put("headers",new JSONObject().put("Content-Type","application/json"));
      }catch(Exception e){try{result.put("error","接口请求未完成（"+e.getClass().getSimpleName()+"），未自动重试；请核对已保存状态与费用");}catch(Exception ignored){}}
      finally{active.remove(id);cancelled.remove(id);if(connection!=null)connection.disconnect();}
      final String value=result.toString();main.post(()->web.evaluateJavascript("globalThis.__novelHttpResult&&globalThis.__novelHttpResult("+JSONObject.quote(id)+","+JSONObject.quote(value)+")",null));
    });
  }
}
