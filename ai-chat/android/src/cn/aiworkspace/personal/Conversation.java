package cn.aiworkspace.personal;
import org.json.*;

public final class Conversation {
 public static JSONArray history(JSONArray messages)throws JSONException{JSONArray out=new JSONArray();for(int i=0;i<messages.length();i++){JSONObject m=messages.getJSONObject(i);String role=J.str(m,"role"),body=J.str(m,"body");if(body.isEmpty()||(!role.equals("user")&&!role.equals("assistant")))continue;if(role.equals("assistant")&&!m.optString("state").equals("done"))continue;out.put(J.obj("role",role,"content",body));}return out;}
 public static String instructions(JSONObject project,JSONArray files)throws JSONException{StringBuilder s=new StringBuilder(J.str(project,"instructions"));for(int i=0;i<files.length();i++){JSONObject f=files.getJSONObject(i);s.append("\n\n<project-reference name=\"").append(J.str(f,"name").replace("\"","'")).append("\">\n").append(J.str(f,"body")).append("\n</project-reference>");}return s.toString();}
}
