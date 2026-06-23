package inwiz;

import inout.Out;

public class ReadStringMain {
    public static void main (String[] args) {
        In.debugOutput();
        String x = In.readString();
        In.debugOutput();
        while (In.done()) {
            Out.println("x = %s".formatted(x));
            x = In.readString();
            In.debugOutput();
        }
    }
}
