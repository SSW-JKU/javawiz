# Code
```java
public class ExceptionOverride {
    public static void main(String[] args) throws Exception {
        throw new MyException("test");
    }
}

class MyException extends Exception {
  public MyException(String msg) {
    super(msg);
  }

  public StackTraceElement[] getStackTrace() {
    return null;
  }
}
```

# End Result
* Causes NullPointerException in the backend (fixed because exception lines do not need to be changed if we don't use line mapping)