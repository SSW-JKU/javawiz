public class HitBox {
    
  public static void main(String[] args) {
    bar();
    foo();
    for(int i = 0; i < 1 && foo(); i++) {}

    for(;;){break;}
    
    for(int i = 0; i < 10 &&             foo(); foo(), foo(), foo(), foo(), i++) {}

    for(int i = 0;false && foo(); i++) {}
    while(foo()){break;}
    do{break;}while(foo());

    for(int X = 0;/*asdf*/ X < 1 && foo(); X++) {}

  }

  static boolean foo() {
    return true;
  }

  static boolean bar() {
    return foo() || foo();
  }
}
