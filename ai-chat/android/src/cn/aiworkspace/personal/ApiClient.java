package cn.aiworkspace.personal;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.*;

/** One explicit HTTP attempt. Fixed-length POST, no redirects, SDKs or automatic replay. */
public final class ApiClient {
 public interface Listener {void progress(ApiProtocol.Output output)throws Exception;}
 private volatile HttpURLConnection connection;private volatile boolean cancelled=false;
 public void cancel(){cancelled=true;HttpURLConnection c=connection;if(c!=null)c.disconnect();}
 public boolean cancelled(){return cancelled;}
 public ApiProtocol.Output generate(JSONObject profile,String model,String key,JSONObject payload,Listener listener)throws Exception{return generateAt(profile,ApiProtocol.endpoint(profile,model,false),key,payload,listener,false);}
 // Local test transport is explicit and cannot be enabled by the Android UI/profile.
 public ApiProtocol.Output generateAt(JSONObject p,String endpoint,String key,JSONObject payload,Listener listener,boolean localTest)throws Exception{
  ApiProtocol.Output output=new ApiProtocol.Output();HttpURLConnection c=open(endpoint,p,key,localTest);try{byte[] body=payload.toString().getBytes("UTF-8");c.setRequestMethod("POST");c.setDoOutput(true);c.setFixedLengthStreamingMode(body.length);if(cancelled)throw new IOException("已停止");try(OutputStream out=c.getOutputStream()){out.write(body);}int code=c.getResponseCode();if(code<200||code>=300)throw failure(c,code,key);String type=c.getContentType();InputStream input=c.getInputStream();
   if(type!=null&&type.toLowerCase(Locale.ROOT).contains("text/event-stream")){readSse(new InputStreamReader(input,"UTF-8"),(event,data)->{if(cancelled)throw new IOException("已停止");output.event(J.str(p,"protocol"),event,data);if(output.text.length()>8000000)throw new IOException("回答超过本机单条8百万字符上限，部分内容已保留");listener.progress(output);});}
   else{output.full(J.str(p,"protocol"),new JSONObject(read(input,32000000)));listener.progress(output);}
   if(cancelled)throw new IOException("已停止");if(!output.terminal)throw new IOException("连接结束但未收到完成标记，部分回答保留；没有自动重试");if(output.text.length()==0)throw new IOException("服务商已结束但没有返回文字；请核对模型是否支持文字聊天及输出参数");return output;
  }catch(Exception e){String message=e.getMessage()==null?e.toString():e.getMessage();if(key!=null&&!key.isEmpty())message=message.replace(key,"[已隐藏密钥]");throw new IOException(message);}
  finally{c.disconnect();connection=null;}
 }
 private HttpURLConnection open(String endpoint,JSONObject p,String key,boolean localTest)throws Exception{URL u=new URL(endpoint);boolean loopback=localTest&&"http".equals(u.getProtocol())&&Arrays.asList("127.0.0.1","localhost").contains(u.getHost());J.require("https".equals(u.getProtocol())||loopback,"只允许 HTTPS API 地址");J.require(u.getUserInfo()==null,"地址不能带鉴权信息");HttpURLConnection c=(HttpURLConnection)u.openConnection();connection=c;c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(p.optInt("timeout",180)*1000);c.setUseCaches(false);c.setRequestProperty("Connection","close");for(Map.Entry<String,String> h:ApiProtocol.headers(p,key).entrySet())c.setRequestProperty(h.getKey(),h.getValue());return c;}
 public List<String> models(JSONObject p,String key)throws Exception{HttpURLConnection c=open(ApiProtocol.endpoint(p,"",true),p,key,false);try{c.setRequestProperty("Accept","application/json");int code=c.getResponseCode();if(code!=200)throw failure(c,code,key);return ApiProtocol.modelIds(p,new JSONObject(read(c.getInputStream(),8000000)));}finally{c.disconnect();connection=null;}}
 private IOException failure(HttpURLConnection c,int code,String key)throws IOException{String value=read(c.getErrorStream(),128000);try{JSONObject o=new JSONObject(value);Object e=o.opt("error");value=e instanceof JSONObject?((JSONObject)e).optString("message",e.toString()):o.optString("message",String.valueOf(e));}catch(Exception ignored){}if(key!=null&&!key.isEmpty())value=value.replace(key,"[已隐藏密钥]");return new IOException("HTTP "+code+"："+value.substring(0,Math.min(value.length(),1800))+"\n未自动重试。");}
 public static String read(InputStream input,int max)throws IOException{if(input==null)return "";try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>max)throw new IOException("响应超过允许大小");out.write(b,0,n);}return new String(out.toByteArray(),"UTF-8");}}
 public interface EventConsumer{void accept(String event,String data)throws Exception;}
 public static void readSse(Reader source,EventConsumer consumer)throws Exception{try(BufferedReader r=new BufferedReader(source)){String event="",line;StringBuilder data=new StringBuilder();boolean first=true;while((line=r.readLine())!=null){if(first){line=line.replaceFirst("^\\uFEFF","");first=false;}if(line.isEmpty()){if(data.length()>0){consumer.accept(event,data.substring(0,data.length()-1));data.setLength(0);}event="";continue;}if(line.startsWith(":"))continue;int i=line.indexOf(':');String name=i<0?line:line.substring(0,i),value=i<0?"":line.substring(i+1);if(value.startsWith(" "))value=value.substring(1);if(name.equals("event"))event=value;if(name.equals("data")){data.append(value).append('\n');if(data.length()>4000000)throw new IOException("单个流事件过大");}}if(data.length()>0)consumer.accept(event,data.substring(0,data.length()-1));}}
}
