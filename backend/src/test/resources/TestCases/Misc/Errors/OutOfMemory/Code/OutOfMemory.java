import java.util.*;

public class OutOfMemory {
    public static void main(String[] args) {
        List<int[]> arrs = new ArrayList<int[]>();
        int i = 0;
        while(true) {
            arrs.add(new int[25_000_000]);// This must be small enough to take less than a second, otherwise the backend assumes we are waiting for input
            Out.println(i + ": " + arrs.getLast());
            i++;
            if(Math.random() > 1.0) break; // To prevent compiler from complaining about unreachable println statement
        }
        Out.println("Here be dragons " + arrs.stream().map(x -> x[0]).count());
    }
}