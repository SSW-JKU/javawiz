package pckg1.pckg2;

public class Other {
    public static void bar() {
        Inner.buzz();
    }

    public class Inner {
        static void buzz() {
            System.out.println("finally");
        }
    }
}