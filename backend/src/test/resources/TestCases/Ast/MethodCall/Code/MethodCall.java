public class MethodCall {
    public static void main(String[] args) {
        foo();
        Base a = new A(); // should point to {A}
        a.bar(); // should point to {A.bar, B.bar, Base.bar}
        a.buzz(); // should point to Base
        System.out.println(); // should point to {}
        Object o = new Object(); // should point to {}
        Base b = new Base();
        foo(2); // should point to correct foo
        foo(3,4,5); // should point to correct foo
        B bb = new B();
        foo(bb);
    }

    static void foo() {}

    static void foo(int i) {}

    static void foo(int i, int... vargs) {}

    static void foo(Base b) {}
}

class Base {
    void bar() {}

    static void buzz() {}
}

class A extends Base {
    @Override
    void bar() {

    }

    static void buzz() {}
}

class B extends Base {
    @Override
    void bar() {

    }
}