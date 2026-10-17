package cn.novelfactory.personal;
import java.net.URI;
final class CloudPolicy {
  static String origin(String value)throws Exception{
    URI u=new URI(value.trim());String h=u.getHost();
    if(!"https".equalsIgnoreCase(u.getScheme())||h==null||!h.matches("[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\\.[A-Za-z]{2,63}")||u.getUserInfo()!=null||(u.getPort()!=-1&&u.getPort()!=443)||u.getQuery()!=null||u.getFragment()!=null||!(u.getPath()==null||u.getPath().isEmpty()||"/".equals(u.getPath())))throw new IllegalArgumentException("请输入自己的纯HTTPS云端地址，不含路径、账号或参数");
    return "https://"+h.toLowerCase(java.util.Locale.ROOT);
  }
  static boolean route(String path,String method){
    try{URI u=new URI(path);if(u.isAbsolute()||u.getAuthority()!=null||u.getFragment()!=null||path.length()>16000)return false;String p=u.getPath();return ("/api/workspace".equals(p)&&("GET".equals(method)||"POST".equals(method)))||("/api/status".equals(p)&&"GET".equals(method));}catch(Exception e){return false;}
  }
}
