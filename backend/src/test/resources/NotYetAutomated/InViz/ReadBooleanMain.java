package inwiz;

import inout.Out;

public class ReadBooleanMain {
    public static void main (String[] args) {
        In.debugOutput();
        boolean x = In.readBoolean();
        In.debugOutput();
        while (In.done()) {
            Out.println("x = %s".formatted(x));
            x = In.readBoolean();
            In.debugOutput();
        }
    }
}
