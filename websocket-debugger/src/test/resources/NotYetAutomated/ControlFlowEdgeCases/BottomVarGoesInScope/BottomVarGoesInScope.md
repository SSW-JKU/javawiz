# Code
```java
public class BottomVarGoesInScope {

    static int max(int x, int y) {
        if (x > y) return x; 
        else return y;
    }

    public static void main (String[] arg) {
      int i = 0;
      int m = max(i, 2);
    }
}
```

# End Result
![img_1.png](img_1.png)!

# Remarks
* This once caused a bug: if the variable `m` enters the scope after the method call to max, 
then the parameter values for max get shifted in the desk test.