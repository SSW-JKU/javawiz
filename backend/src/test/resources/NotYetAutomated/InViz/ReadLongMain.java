package inwiz;

import inout.Out;

public class ReadLongMain {
    public static void main (String[] args) {
        In.debugOutput();
        long x = In.readLong();
        In.debugOutput();
        while (In.done() && x >= 0) {
            Out.println("x = %d".formatted(x));
            x = In.readLong();
            In.debugOutput();
        }
    }
}
