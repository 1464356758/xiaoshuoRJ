import org.junit.runner.*;
import org.junit.runner.notification.*;
import java.io.*;
import java.nio.file.*;

public final class NativeRunner {
 public static void main(String[] args)throws Exception{
  PrintStream original=System.out;Result result=JUnitCore.runClasses(cn.aiworkspace.personal.NativeChecks.class);
  StringBuilder report=new StringBuilder("Tests: "+result.getRunCount()+"; failed: "+result.getFailureCount()+"\n");
  for(Failure failure:result.getFailures())report.append(failure).append('\n').append(failure.getTrace()).append('\n');
  Files.write(Paths.get(args[0]),report.toString().getBytes("UTF-8"));original.print(report);System.exit(result.wasSuccessful()?0:1);
 }
}
