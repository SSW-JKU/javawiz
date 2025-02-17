public class WithInner {
    public static void main(String[] args) {
      Inner.foo();
    }
  
    class Inner {
      static void foo() {
        System.out.println();
      }
    }
  }