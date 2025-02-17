import java.util.*;

public class OutOfMemory {
    public static void main(String[] args) {
        List<int[]> arrs = new ArrayList<int[]>();
        while(true) {
            arrs.add(new int[25_000_000]);
            if(Math.random() > 1.0) break; // To prevent compiler from complaining about unreachable println statement
        }
        Out.println("Here be dragons " + arrs.get(0));
    }
}