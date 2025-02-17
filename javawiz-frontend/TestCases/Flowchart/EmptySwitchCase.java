public class EmptySwitchCase { // JW-109
    public static void main(String[] args) {
      int k = 3;
      String s = "adsf";
      switch(k) {
        case 0:break;
        case 3:
        System.out.println(s);
        break;
      }
    }
  }
  