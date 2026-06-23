package inwiz;

import inout.Out;

public class ReadIntMain {
    public static void main (String[] args) {
        In.debugOutput();
        int x = In.readInt();
        In.debugOutput();
        while (In.done() && x >= 0) {
            Out.println("x = %d".formatted(x));
            x = In.readInt();
            In.debugOutput();
        }
    }
}
