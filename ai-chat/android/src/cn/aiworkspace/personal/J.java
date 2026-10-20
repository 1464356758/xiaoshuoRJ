package cn.aiworkspace.personal;
import org.json.*;
import java.util.*;

public final class J {
 public static JSONObject obj(Object... pairs){JSONObject o=new JSONObject();try{for(int i=0;i<pairs.length;i+=2)o.put((String)pairs[i],pairs[i+1]==null?JSONObject.NULL:pairs[i+1]);}catch(JSONException e){throw new IllegalArgumentException(e);}return o;}
 public static JSONObject copy(JSONObject o){try{return new JSONObject(o.toString());}catch(JSONException e){throw new IllegalArgumentException(e);}}
 public static String str(JSONObject o,String k){return o==null||o.isNull(k)?"":o.optString(k,"");}
 public static String id(){return UUID.randomUUID().toString();}
 public static void require(boolean ok,String message){if(!ok)throw new IllegalArgumentException(message);}
 public static JSONArray array(Collection<String> list){JSONArray a=new JSONArray();for(String s:list)a.put(s);return a;}
 public static String pretty(Object value){try{if(value instanceof JSONObject)return ((JSONObject)value).toString(2);if(value instanceof JSONArray)return ((JSONArray)value).toString(2);}catch(Exception ignored){}return String.valueOf(value);}
 public static JSONObject noSecrets(JSONObject value){JSONObject out=new JSONObject();try{Iterator<String> it=value.keys();while(it.hasNext()){String k=it.next();if(k.equals("keyCipher")||k.equals("apiKey"))continue;Object v=value.get(k);if(v instanceof JSONObject)v=noSecrets((JSONObject)v);if(v instanceof JSONArray){JSONArray a=new JSONArray(),src=(JSONArray)v;for(int i=0;i<src.length();i++){Object item=src.get(i);a.put(item instanceof JSONObject?noSecrets((JSONObject)item):item);}v=a;}out.put(k,v);}}catch(JSONException e){throw new IllegalArgumentException(e);}return out;}
}
