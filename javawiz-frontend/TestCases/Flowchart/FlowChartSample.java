public class FlowChartSample {
    public static void main(String[] args) {
        varHover();
        ifThenElseLayout();
        highlightRepeat();
        inlineMethodCall();
        tryCatchLayout();
    }

    static void varHover() {
        int a = 10;
        int b = 20;
        a++;
        String s = "asdf";
        char t = 'a';
        s = "qwertz";
        double d = 1.222222222222222;
        foo(a, b);
        int c = 30;

        for(int i = 0; i < 2; i++) {
          System.out.println(i);
        }
    
        int j = 0;
        while(j < 3) {
          j++;
        }

        int k = 0;
        do {
          k++;
        } while(k < 3);

        switch(k) {
          case 0:break;
          case 3:
          System.out.println(s);
          break;
        }
  }

  static void foo(int i, int j) {
    int k = i + j;
    if(k > 0) {
      k++;
    }
  }

  static void ifThenElseLayout() {
    if(true) {
        System.out.println("a short statement");
      } else {
        System.out.println("a loooooooooooooooooooooooooong statmeeeeeeeeeeeeeeent");
      }
  
      boolean condiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiition = false;
  
      if(condiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiition) {
        System.out.println("a short statement");
      } else {
        System.out.println("a loooooooooooooooooooooooooong statmeeeeeeeeeeeeeeent");
      }
    
    }

    static void highlightRepeat() {
        foo1();
        foo1();
    }

    static void inlineMethodCall() {
        int x = 3; 
        bar1(); foo1();
        int y = -1;

        for(int i = 0; c(i); i++) {
          foo1();
        }

        int j = 0; 
        while(c(j)) { j++; }

        int k = 0;
        do { k++; foo1(); bar1(); } while(c(k));

        switch(k) {
          case 2: foo1(); break;
          default: bar1();
        }

        try {
          foo1();
        } catch(Exception e) {
          foo1();
          bar1();
        } finally {
          bar1();
        }

        if (pos(x) && pos(y)) {
          foo1();
        } else {
          foo1(); 
        }
    }

    static boolean c(int i) {
        return i < 2;
      }
    
    static void foo1() {
      bar1();
    }
    
    static void bar1() {
      System.out.println("asdf");
    }

    static boolean pos(int x) {
      return x > 0; 
    }

    static void switchLayout() {
        switch ("num") {
            case "1000000":
                System.out.println("The number is zero.");

            case "1":
                System.out.println("The number is ten.");
                break;

            default:
                System.out.println("The number is neither zero nor ten.");
        }
        switch ("num") {
            case "1000000":
                System.out.println("The number is zero.");

            case "1":
                System.out.println("The number is ten.");
                break;

            default:
                System.out.println("The number is neither zero nor ten.");
                break;
        }
        switch ("num") {
            case "1000000":
                System.out.println("The number is zero.");

            case "1":
                System.out.println("The number is ten.");
        }
        switch ("num") {
            case "1000000":
                System.out.println("The number is zero.");

            case "1":
                System.out.println("The number is ten.");
                break;
        }
    }


    static void tryCatchLayout() {
        try {
            int result = 10 / 0; // This will cause an ArithmeticException
            System.out.println("Result: " + result);
        } catch (ArithmeticException e) {
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            foo1();
        } catch(Exception e) {
            System.out.println("one line");
        } finally {
            System.out.println("Finally block executed.");
        }

        try {
            int result = 10 / 0; // This will cause an ArithmeticException
            System.out.println("Result: " + result);
        } catch (NullPointerException e) {
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
        } catch(Exception e) {
            System.out.println("one line");
        } finally {
            System.out.println("Finally block executed.");
        }

        try {
            int result = 10 / 0; // This will cause an ArithmeticException
            System.out.println("Result: " + result);
        } catch (NullPointerException e) {
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
            System.out.println("many lines");
        } catch(Exception e) {
            System.out.println("one line");
        }
    }
}


