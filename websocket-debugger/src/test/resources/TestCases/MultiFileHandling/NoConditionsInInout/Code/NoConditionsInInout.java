import inout.In;
public class NoConditionsInInout {
    public static void main(String[] args) {
        inout.In.foo(); // make sure that the conditions in here don't get logged
        SomethIn.foo(); // make sure that the conditions in here get logged
    }
}