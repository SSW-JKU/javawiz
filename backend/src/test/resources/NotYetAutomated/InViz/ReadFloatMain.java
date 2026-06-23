package inwiz;

import inout.Out;

public class ReadFloatMain {
    public static void main (String[] args) {
        In.debugOutput();
        float x = In.readFloat();
        In.debugOutput();
        while (In.done() && x >= 0) {
            Out.println("x = %f".formatted(x));
            x = In.readFloat();
            In.debugOutput();
        }
    }
}
