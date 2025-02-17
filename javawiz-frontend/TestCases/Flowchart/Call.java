public class Call { // JW-107
    public static void main(String[] args) {
      int x = 3; 
      bar(); foo();
      int y = -1;
  
      for(int i = 0; c(i); i++) {
        foo();
      }
  
      int j = 0; 
      while(c(j)) { j++; }
  
      int k = 0;
      do { k++; foo(); bar(); } while(c(k));
  
      switch(k) {
        case 2: foo(); break;
        default: bar();
      }
  
      try {
        foo();
      } catch(Exception e) {
        foo();
        bar();
      } finally {
        bar();
      }
  
      if (pos(x) && pos(y)) {
        foo();
      } else {
        foo(); 
      }
    }
  
    static boolean c(int i) {
      return i < 2;
    }
  
    static void foo() {
      bar();
    }
    
    static void bar() {
      System.out.println("asdf");
    }
  
    static boolean pos(int x) {
      return x > 0; 
    }
  }
  