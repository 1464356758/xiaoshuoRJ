package cn.novelfactory.personal;
public final class CloudPolicyCheck {
  static int count;
  static void origin(String value,boolean expected)throws Exception{boolean accepted;try{CloudPolicy.origin(value);accepted=true;}catch(Exception e){accepted=false;}if(accepted!=expected)throw new AssertionError(value);count++;}
  static void route(String value,String method,boolean expected){if(CloudPolicy.route(value,method)!=expected)throw new AssertionError(value);count++;}
  public static void main(String[] args)throws Exception{
    origin("https://example.com",true);origin("https://novel.up.railway.app/",true);origin("http://example.com",false);origin("https://user:pass@example.com",false);origin("https://example.com/api",false);origin("https://example.com?token=secret",false);origin("https://127.0.0.1",false);origin("https://example.com#secret",false);
    route("/api/workspace?book=example","GET",true);route("/api/workspace","POST",true);route("/api/status","GET",true);route("/api/status","POST",false);route("https://evil.example/api/workspace","POST",false);route("//evil.example/api/workspace","GET",false);route("/api/workspace#part","POST",false);route("/api/../admin","POST",false);
    System.out.println("Cloud controller policy: "+count+" checks passed; no network calls.");
  }
}
