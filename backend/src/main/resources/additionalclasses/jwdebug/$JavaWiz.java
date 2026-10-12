package jwdebug;
import java.util.Comparator;
import java.util.function.*;
import java.util.stream.Collector;
import java.util.stream.DoubleStream;
import java.util.stream.IntStream;
import java.util.stream.LongStream;
import java.util.stream.Stream;
import java.util.Map;
import java.util.Iterator;
import java.util.Collection;
import java.util.stream.Collectors;
import java.util.Arrays;
import java.util.ArrayDeque;
import java.util.Spliterator;
import java.util.function.Function;
import java.util.stream.StreamSupport;
import java.util.function.IntConsumer;
import java.util.function.LongConsumer;
import java.util.function.DoubleConsumer;

public class $JavaWiz {
    private static int nextStreamExecutionId = 0;
    private static final ArrayDeque<RuntimeStreamFrame> activeStreamFrames = new ArrayDeque<>();
    public static int activeStreamExecutionId = 0;
    public static int completedStreamExecutionId = 0;
    public static boolean completedStreamHadStart = false;
    public static String completedOperationName = "";
    public static int completedOperationId = -1;
    public static String completedOperationParameter = "";
    public static String completedResultText = "";
    public static int exhaustedChildExecutionId = 0;

    private static final class RuntimeStreamFrame {
        final int id;
        boolean sawStart;

        RuntimeStreamFrame(int id) {
            this.id = id;
        }
    }

    private static void observeStart(int operationId) {
        if (activeStreamFrames.isEmpty()) {
            activeStreamFrames.push(new RuntimeStreamFrame(++nextStreamExecutionId));
        }
        RuntimeStreamFrame frame = activeStreamFrames.peek();
        frame.sawStart = true;
        activeStreamExecutionId = frame.id;
    }

    private static void complete(String operationName, int operationId, String operationParameter, String resultText) {
        RuntimeStreamFrame completed;
        if (activeStreamFrames.isEmpty()) {
            completed = new RuntimeStreamFrame(++nextStreamExecutionId);
        } else {
            completed = activeStreamFrames.pop();
        }
        completedStreamExecutionId = completed.id;
        completedStreamHadStart = completed.sawStart;
        completedOperationName = operationName;
        completedOperationId = operationId;
        completedOperationParameter = operationParameter;
        completedResultText = resultText == null ? "null" : resultText;
        activeStreamExecutionId = activeStreamFrames.isEmpty() ? 0 : activeStreamFrames.peek().id;
    }

    public static <T> T completeStreamVisualization(String operationName, int operationId, String operationParameter, T value) {
        complete(operationName, operationId, operationParameter, completionText(value));
        return value;
    }

    public static void completeStreamVisualization(String operationName, int operationId, String operationParameter, Runnable terminal) {
        terminal.run();
        complete(operationName, operationId, operationParameter, "forEach");
    }

    private static String completionText(Object value) {
        if (value instanceof java.util.Optional) {
            java.util.Optional<?> optional = (java.util.Optional<?>) value;
            return optional.map(String::valueOf).orElse("Optional.empty");
        }
        if (value instanceof java.util.OptionalInt) {
            java.util.OptionalInt optional = (java.util.OptionalInt) value;
            return optional.isPresent() ? Integer.toString(optional.getAsInt()) : "OptionalInt.empty";
        }
        if (value instanceof java.util.OptionalLong) {
            java.util.OptionalLong optional = (java.util.OptionalLong) value;
            return optional.isPresent() ? Long.toString(optional.getAsLong()) : "OptionalLong.empty";
        }
        if (value instanceof java.util.OptionalDouble) {
            java.util.OptionalDouble optional = (java.util.OptionalDouble) value;
            return optional.isPresent() ? Double.toString(optional.getAsDouble()) : "OptionalDouble.empty";
        }
        return String.valueOf(value);
    }

    public static <T, R> Function<T, Stream<R>> wrapFlatMapMapper(
            int operationId,
            Function<? super T, ? extends Stream<? extends R>> mapper
    ) {
        return value -> {
            int parentId = activeStreamExecutionId;
            Stream<? extends R> child = mapper.apply(value);
            Spliterator<? extends R> source = child.spliterator();
            final int childExecutionId = ++nextStreamExecutionId;
            Spliterator<R> wrapped = new Spliterator<R>() {
                private boolean childActive = true;

                @Override
                public boolean tryAdvance(Consumer<? super R> action) {
                    if (childActive && activeStreamExecutionId != childExecutionId) {
                        activeStreamFrames.push(new RuntimeStreamFrame(childExecutionId));
                        activeStreamExecutionId = childExecutionId;
                    }
                    boolean advanced = source.tryAdvance((Consumer<? super R>) element -> {
                        int childId = activeStreamExecutionId;
                        if (childId != parentId) {
                            RuntimeStreamFrame frame = activeStreamFrames.pop();
                            activeStreamExecutionId = activeStreamFrames.isEmpty() ? 0 : activeStreamFrames.peek().id;
                            action.accept(element);
                            activeStreamFrames.push(frame);
                            activeStreamExecutionId = frame.id;
                        } else {
                            action.accept(element);
                        }
                    });
                    if (!advanced && childActive) {
                        childActive = false;
                        endNestedFlatmapStream();
                    }
                    return advanced;
                }

                @Override public Spliterator<R> trySplit() { return null; }
                @Override public long estimateSize() { return source.estimateSize(); }
                @Override public int characteristics() { return source.characteristics(); }
            };
            @SuppressWarnings("unchecked")
            Stream<R> result = (Stream<R>) StreamSupport.stream(wrapped, false);
            return result.onClose(child::close);
        };
    }

    public static IntFunction<IntStream> wrapFlatMapToIntMapper(
            int operationId,
            IntFunction<? extends IntStream> mapper
    ) {
        return value -> {
            int parentId = activeStreamExecutionId;
            IntStream child = mapper.apply(value);
            int childId = ++nextStreamExecutionId;
            Spliterator.OfInt source = child.spliterator();
            Spliterator.OfInt wrapped = new Spliterator.OfInt() {
                private boolean childActive = true;

                @Override
                public boolean tryAdvance(IntConsumer action) {
                    if (childActive && activeStreamExecutionId != childId) {
                        activeStreamFrames.push(new RuntimeStreamFrame(childId));
                        activeStreamExecutionId = childId;
                    }
                    boolean advanced = source.tryAdvance((IntConsumer) element -> {
                        RuntimeStreamFrame frame = activeStreamFrames.isEmpty() ? null : activeStreamFrames.pop();
                        activeStreamExecutionId = activeStreamFrames.isEmpty() ? 0 : activeStreamFrames.peek().id;
                        action.accept(element);
                        if (frame != null) {
                            activeStreamFrames.push(frame);
                            activeStreamExecutionId = frame.id;
                        }
                    });
                    if (!advanced && childActive) {
                        childActive = false;
                        endNestedFlatmapStream();
                    }
                    return advanced;
                }

                @Override public Spliterator.OfInt trySplit() { return null; }
                @Override public long estimateSize() { return source.estimateSize(); }
                @Override public int characteristics() { return source.characteristics(); }
            };
            return StreamSupport.intStream(wrapped, false).onClose(child::close);
        };
    }

    public static LongFunction<LongStream> wrapFlatMapToLongMapper(
            int operationId,
            LongFunction<? extends LongStream> mapper
    ) {
        return value -> {
            LongStream child = mapper.apply(value);
            int childId = ++nextStreamExecutionId;
            Spliterator.OfLong source = child.spliterator();
            Spliterator.OfLong wrapped = new Spliterator.OfLong() {
                private boolean childActive = true;

                @Override
                public boolean tryAdvance(LongConsumer action) {
                    if (childActive && activeStreamExecutionId != childId) {
                        activeStreamFrames.push(new RuntimeStreamFrame(childId));
                        activeStreamExecutionId = childId;
                    }
                    boolean advanced = source.tryAdvance((LongConsumer) element -> {
                        RuntimeStreamFrame frame = activeStreamFrames.isEmpty() ? null : activeStreamFrames.pop();
                        activeStreamExecutionId = activeStreamFrames.isEmpty() ? 0 : activeStreamFrames.peek().id;
                        action.accept(element);
                        if (frame != null) {
                            activeStreamFrames.push(frame);
                            activeStreamExecutionId = frame.id;
                        }
                    });
                    if (!advanced && childActive) {
                        childActive = false;
                        endNestedFlatmapStream();
                    }
                    return advanced;
                }

                @Override public Spliterator.OfLong trySplit() { return null; }
                @Override public long estimateSize() { return source.estimateSize(); }
                @Override public int characteristics() { return source.characteristics(); }
            };
            return StreamSupport.longStream(wrapped, false).onClose(child::close);
        };
    }

    public static DoubleFunction<DoubleStream> wrapFlatMapToDoubleMapper(
            int operationId,
            DoubleFunction<? extends DoubleStream> mapper
    ) {
        return value -> {
            DoubleStream child = mapper.apply(value);
            int childId = ++nextStreamExecutionId;
            Spliterator.OfDouble source = child.spliterator();
            Spliterator.OfDouble wrapped = new Spliterator.OfDouble() {
                private boolean childActive = true;

                @Override
                public boolean tryAdvance(DoubleConsumer action) {
                    if (childActive && activeStreamExecutionId != childId) {
                        activeStreamFrames.push(new RuntimeStreamFrame(childId));
                        activeStreamExecutionId = childId;
                    }
                    boolean advanced = source.tryAdvance((DoubleConsumer) element -> {
                        RuntimeStreamFrame frame = activeStreamFrames.isEmpty() ? null : activeStreamFrames.pop();
                        activeStreamExecutionId = activeStreamFrames.isEmpty() ? 0 : activeStreamFrames.peek().id;
                        action.accept(element);
                        if (frame != null) {
                            activeStreamFrames.push(frame);
                            activeStreamExecutionId = frame.id;
                        }
                    });
                    if (!advanced && childActive) {
                        childActive = false;
                        endNestedFlatmapStream();
                    }
                    return advanced;
                }

                @Override public Spliterator.OfDouble trySplit() { return null; }
                @Override public long estimateSize() { return source.estimateSize(); }
                @Override public int characteristics() { return source.characteristics(); }
            };
            return StreamSupport.doubleStream(wrapped, false).onClose(child::close);
        };
    }

    // TODO: Add a general child-stream boundary for streams created by arbitrary callbacks.
    public static void endNestedFlatmapStream() {
        if (activeStreamFrames.size() > 1) {
            RuntimeStreamFrame child = activeStreamFrames.pop();
            exhaustedChildExecutionId = child.id;
            activeStreamExecutionId = activeStreamFrames.peek().id;
        }
    }

    private static void updateActive(String eventKind, int operationId) {
        if ("START".equals(eventKind)) observeStart(operationId);
    }

    public static void traceStream(String eventKind, Object element, String operationName, int operationId, String operationParameter) {
        updateActive(eventKind, operationId);
    }
    public static void traceStream(String eventKind, Object element, String operationName, int operationId, String operationParameter, String terminalResultText) {
        updateActive(eventKind, operationId);
    }
    public static void traceStream(String eventKind, String element, String operationName, int operationId, String operationParameter) {
        updateActive(eventKind, operationId);
    }
    public static void traceStream(String eventKind, int element, String operationName, int operationId, String operationParameter) {
        updateActive(eventKind, operationId);
    }
    public static void traceStream(String eventKind, long element, String operationName, int operationId, String operationParameter) {
        updateActive(eventKind, operationId);
    }
    public static void traceStream(String eventKind, double element, String operationName, int operationId, String operationParameter) {
        updateActive(eventKind, operationId);
    }
    public static void traceStream(String eventKind, float element, String operationName, int operationId, String operationParameter) {
        updateActive(eventKind, operationId);
    }
    public static void traceStream(String eventKind, char element, String operationName, int operationId, String operationParameter) {
        updateActive(eventKind, operationId);
    }
    public static void traceStream(String eventKind, byte element, String operationName, int operationId, String operationParameter) {
        updateActive(eventKind, operationId);
    }
    public static void traceStream(String eventKind, short element, String operationName, int operationId, String operationParameter) {
        updateActive(eventKind, operationId);
    }
    public static void traceStream(String eventKind, boolean element, String operationName, int operationId, String operationParameter) {
        updateActive(eventKind, operationId);
    }
    public static boolean recordCondition(boolean value, int conditionId) {
        return value;
    }

    public static int recordArrayAccess(Object array, int index, int arrayAccessId, int dimension) {
        return index;
    }

    public static void traceStream(String eventKind, Object element, String operationName, int operationId, int streamId, String operationParameter) {}
    public static void traceStream(String eventKind, Object element, String operationName, int operationId, int streamId, String operationParameter, String terminalResultText) {}
    public static void traceStream(String eventKind, String element, String operationName, int operationId, int streamId, String operationParameter) {}
    public static void traceStream(String eventKind, int element, String operationName, int operationId, int streamId, String operationParameter) {}
    public static void traceStream(String eventKind, long element, String operationName, int operationId, int streamId, String operationParameter) {}
    public static void traceStream(String eventKind, double element, String operationName, int operationId, int streamId, String operationParameter) {}
    public static void traceStream(String eventKind, float element, String operationName, int operationId, int streamId, String operationParameter) {}
    public static void traceStream(String eventKind, char element, String operationName, int operationId, int streamId, String operationParameter) {}
    public static void traceStream(String eventKind, byte element, String operationName, int operationId, int streamId, String operationParameter) {}
    public static void traceStream(String eventKind, short element, String operationName, int operationId, int streamId, String operationParameter) {}
    public static void traceStream(String eventKind, boolean element, String operationName, int operationId, int streamId, String operationParameter) {}

    /**
     * Completes an instrumented boolean-valued terminal operation without changing its result.
     * The rebuild runs after the terminal expression has been evaluated.
     */
    public static boolean completeStreamVisualization(boolean value) {
        rebuildStreamVisualization();
        return value;
    }

    /**
     * Completes an instrumented int-valued terminal operation without changing its result.
     * The rebuild runs after the terminal expression has been evaluated.
     */
    public static int completeStreamVisualization(int value) {
        rebuildStreamVisualization();
        return value;
    }

    /**
     * Completes an instrumented long-valued terminal operation without changing its result.
     * The rebuild runs after the terminal expression has been evaluated.
     */
    public static long completeStreamVisualization(long value) {
        rebuildStreamVisualization();
        return value;
    }

    /**
     * Completes an instrumented double-valued terminal operation without changing its result.
     * The rebuild runs after the terminal expression has been evaluated.
     */
    public static double completeStreamVisualization(double value) {
        rebuildStreamVisualization();
        return value;
    }

    /**
     * Completes an instrumented reference-valued terminal operation without changing its result or type.
     * The rebuild runs after the terminal expression has been evaluated.
     */
    public static <T> T completeStreamVisualization(T value) {
        rebuildStreamVisualization();
        return value;
    }

    /**
     * Completes a reduce operation with its actual return value after the reduction has run.
     * This is separate from accumulator tracing because an empty or singleton reduction may
     * never invoke the accumulator at all.
     */
    public static <T> T completeStreamVisualization(
            String operationName,
            int operationId,
            int streamId,
            String operationParameter,
            T value
    ) {
        traceStream("COMPLETION", value, operationName, operationId, streamId, operationParameter, String.valueOf(value));
        rebuildStreamVisualization();
        return value;
    }

    public static <T, A, R> Collector<T, A, R> traceParam(
            String operationName,
            int operationId,
            String operationParameter,
            Collector<T, A, R> base
    ) {
        return Collector.of(
                base.supplier(),
                (acc, t) -> {
                    String stateBefore = stateToString(acc);
                    base.accumulator().accept(acc, t);
                    if (!stateBefore.equals(stateToString(acc))) {
                        traceStream("END", acc, operationName, operationId, operationParameter, acc.toString());
                    } else {
                        traceStream("REPLAY_LAST_TERMINAL", acc, operationName, operationId, operationParameter, acc.toString());
                    }
                },
                base.combiner(),
                base.finisher(),
                base.characteristics().toArray(new Collector.Characteristics[0])
        );
    }
    public static <T, R> Collector<T, R, R> traceParam(
            String operationName,
            int operationId,
            String operationParameter,
            Supplier<R> supplier,
            BiConsumer<R, ? super T> accumulator,
            BiConsumer<R, R> combiner
    ) {
        return Collector.of(
                supplier,
                (acc, t) -> {
                    String stateBefore = stateToString(acc);
                    accumulator.accept(acc, t);
                    if (!stateBefore.equals(stateToString(acc))) {
                        traceStream("END", acc, operationName, operationId, operationParameter, acc.toString());
                    } else {
                        traceStream("REPLAY_LAST_TERMINAL", acc, operationName, operationId, operationParameter, acc.toString());
                    }
                },
                (left, right) -> {
                    combiner.accept(left, right);
                    return left;
                },
                Collector.Characteristics.IDENTITY_FINISH
        );
    }

    public static <T> BinaryOperator<T> traceBinaryParam(String operationName, int operationId, String operationParameter, BinaryOperator<T> op) {
        return (t1, t2) -> {
            T result = op.apply(t1, t2);
            traceStream("END", result, operationName, operationId, operationParameter, String.valueOf(result));
            return result;
        };
    }
    public static IntBinaryOperator traceBinaryParam(String operationName, int operationId, String operationParameter, IntBinaryOperator op) {
        return (a, b) -> {
            int result = op.applyAsInt(a, b);
            traceStream("END", result, operationName, operationId, operationParameter, String.valueOf(result));
            return result;
        };
    }
    public static DoubleBinaryOperator traceBinaryParam(String operationName, int operationId, String operationParameter, DoubleBinaryOperator op) {
        return (a, b) -> {
            double result = op.applyAsDouble(a, b);
            traceStream("END", result, operationName, operationId, operationParameter, String.valueOf(result));
            return result;
        };
    }
    public static LongBinaryOperator traceBinaryParam(String operationName, int operationId, String operationParameter, LongBinaryOperator op) {
        return (a, b) -> {
            long result = op.applyAsLong(a, b);
            traceStream("END", result, operationName, operationId, operationParameter, String.valueOf(result));
            return result;
        };
    }
    public static <T, U> BiFunction<U, ? super T, U> traceBiParam(String operationName, int operationId, String operationParameter, BiFunction<U, ? super T, U> accumulator) {
        return (u, t) -> {
            U result = accumulator.apply(u, t);
            traceStream("END", result, operationName, operationId, operationParameter, String.valueOf(result));
            return result;
        };
    }

    public static <T> Predicate<T> traceParam(
            String operationName,
            int operationId,
            String operationParameter,
            Predicate<T> base
    ) {
        return t -> {
            boolean result = base.test(t);
            traceStream("END", result, operationName, operationId, operationParameter, Boolean.toString(result));
            return result;
        };
    }
    public static IntPredicate traceIntParam(
            String operationName,
            int operationId,
            String operationParameter,
            IntPredicate base
    ) {
        return t -> {
            boolean result = base.test(t);
            traceStream("END", result, operationName, operationId, operationParameter, Boolean.toString(result));
            return result;
        };
    }
    public static DoublePredicate traceDoubleParam(
            String operationName,
            int operationId,
            String operationParameter,
            DoublePredicate base
    ) {
        return t -> {
            boolean result = base.test(t);
            traceStream("END", result, operationName, operationId, operationParameter, Boolean.toString(result));
            return result;
        };
    }
    public static LongPredicate traceLongParam(
            String operationName,
            int operationId,
            String operationParameter,
            LongPredicate base
    ) {
        return t -> {
            boolean result = base.test(t);
            traceStream("END", result, operationName, operationId, operationParameter, Boolean.toString(result));
            return result;
        };
    }

    public static <T>Comparator<T> traceParam(
            String operationName,
            int operationId,
            String operationParameter,
            Comparator<T> base
    ) {
        return (t1, t2) -> {
            int result = base.compare(t1, t2);
            if (result < 0) {
                traceStream("END", t1, operationName, operationId, operationParameter, Integer.toString(result));
            } else {
                traceStream("END", t2, operationName, operationId, operationParameter, Integer.toString(result));
            }
            return result;
        };
    }

    private static String stateToString(Object obj) {
        if (obj instanceof double[]) return Arrays.toString((double[]) obj);
        if (obj instanceof int[])    return Arrays.toString((int[]) obj);
        if (obj instanceof long[])   return Arrays.toString((long[]) obj);
        if (obj instanceof Object[]) return Arrays.deepToString((Object[]) obj);
        return obj.toString();
    }

    public static void rebuildStreamVisualization() {}
}
