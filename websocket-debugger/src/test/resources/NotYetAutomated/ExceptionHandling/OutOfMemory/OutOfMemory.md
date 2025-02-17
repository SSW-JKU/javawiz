# Code
```java
public class OutOfMemory {
    public static void main(String[] args) {
        int[] large = new int[1_000_000_000];
        System.out.println("large array created");
    }
}
```

# End Result
* can't step over the line where the array is created, not sure how to deal with this