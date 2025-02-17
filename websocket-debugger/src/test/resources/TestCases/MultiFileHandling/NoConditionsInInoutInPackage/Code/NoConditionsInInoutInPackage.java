import mypackage.*;

public class NoConditionsInInoutInPackage {
    public static void main(String[] args) {
        In.foo(); // make sure that the conditions in here don't get logged
        SomethIn.foo(); // make sure that the conditions in here get logged
    }
}