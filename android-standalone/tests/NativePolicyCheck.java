package cn.novelfactory.personal;
import java.net.URL;
/** Host JVM check of the compiled native transport policy. Never makes HTTP calls. */
public final class NativePolicyCheck {
  static int count;
  static void check(String url,String method,boolean expected)throws Exception{if(ApiTransport.allowed(new URL(url),method)!=expected)throw new AssertionError(url);count++;}
  public static void main(String[] args)throws Exception{
    check("https://api.deepseek.com/v1/chat/completions","POST",true);
    check("https://api.deepseek.com/user/balance","GET",true);
    check("https://api.deepseek.com/v1/chat/completions","GET",false);
    check("https://api.deepseek.com/user/balance","POST",false);
    check("https://api.deepseek.com.evil.example/v1/chat/completions","POST",false);
    check("https://api.deepseek.com@evil.example/v1/chat/completions","POST",false);
    check("https://api.deepseek.com:443/v1/chat/completions","POST",false);
    check("http://api.deepseek.com/v1/chat/completions","POST",false);
    check("https://127.0.0.1/v1/chat/completions","POST",false);
    check("https://api.deepseek.com/v1/chat/completions?redirect=other","POST",false);
    check("https://api.deepseek.com/v1/chat/completions#fragment","POST",false);
    check("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions","POST",true);
    check("https://test-workspace.dashscope.aliyuncs.com/compatible-mode/v1/chat/completions","POST",true);
    check("https://evil-dashscope.aliyuncs.com/compatible-mode/v1/chat/completions","POST",false);
    check("https://ark.cn-beijing.volces.com/api/v3/chat/completions","POST",true);
    check("https://raw.githubusercontent.com/1464356758/xiaoshuoRJ/main/README.md","GET",true);
    check("https://raw.githubusercontent.com/other/private/main/README.md","GET",false);
    check("https://raw.githubusercontent.com/1464356758/xiaoshuoRJ/main/.env","GET",false);
    check("https://api.github.com/repos/1464356758/xiaoshuoRJ/branches/main","GET",true);
    check("https://api.github.com/user","GET",false);
    check("https://ai-novel-factory.qq1464356758.chatgpt.site/api/workspace","POST",false);
    System.out.println("Native endpoint policy: "+count+" checks passed; no network requests.");
  }
}
