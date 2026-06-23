# Code
```java
public class ConditionInLastLine {
    public static void main(String[] args) {
        foo();
    }

    static void foo() {
        if(true) return;
    }
}
```

# Remarks
In the new implementation for conditions, the condition `true` is not displayed.
This is because there is no step event to log this condition before the return happens.
Therefore, the condition gets cleared before it is sent as part of a step event.

It is unclear whether this issue is severe enough to warrant a fix which makes the backend more complicated, though.