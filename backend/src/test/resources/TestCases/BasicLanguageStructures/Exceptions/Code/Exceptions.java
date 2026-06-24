public class Exceptions {
    public static void main(String[] args) throws Exception {
        try {
            foo();
        } catch (Exception e) {
            e.printStackTrace();
        }
        Out.println("still going");

        try {
            Inner.inner();
        } catch (Exception e) {
            e.printStackTrace();
        }
        Out.println("still going");
        foo();
        Out.println("still going???");
    }

    static void foo() throws Exception {
        if(true) {
            bar();
        }
    }

    static void bar() throws Exception {
        if(true) {
            throw new Exception("hello world");
        }
    }

    static class Inner {
        static void inner() throws Exception {
            foo();
        }
    }
}