import inout.In;
public class NoTraceIn {
    public static void main(String[] args) {
        inout.In.readLine(); // make sure that the class in here doesn't get logged
        SomethIn.foo();
    }
}