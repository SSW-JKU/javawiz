public class MethodCallSample {
    public static void main(String[] args) {
        foo();
        Other.foo();
        foo(1);
        Other other = new Other();
        Other();
        Other.Other();

        Obj myObj = new Obj();
        myObj.foo();

    }

    static void foo() {
        System.out.println("a looooooooooooooooooooooooooooooooooooooooooooong statement");
    }

    static void foo(int i) {
        System.out.println("params");
    }

    static void Other() {
        System.out.println("not this one");
    }
}

class Other {
    public Other() {
        System.out.println("this one");
    }

    static void Other() {
        System.out.println("does this even compile?");
    }


    static void foo() {
        System.out.println();
        System.out.println();
        System.out.println();
        System.out.println();
        System.out.println();
        System.out.println();
        System.out.println();
        System.out.println();
        System.out.println();
        System.out.println();
        System.out.println();
        System.out.println();
        System.out.println();
        System.out.println();
    }
}

class Obj {
    void foo() {
        System.out.println("object method");
    }
}