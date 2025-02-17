package inwiz;

import inout.Out;

public class ReadDoubleMain {
    public static void main (String[] args) {
        In.debugOutput();
        double x = In.readDouble();
        In.debugOutput();
        while (In.done() && x >= 0) {
            Out.println("x = %f".formatted(x));
            x = In.readDouble();
            In.debugOutput();
        }
    }
}
