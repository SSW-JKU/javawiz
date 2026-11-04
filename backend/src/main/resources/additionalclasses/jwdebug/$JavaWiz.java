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
import java.util.ArrayDeque;
import java.util.Spliterator;
import java.util.function.Function;
import java.util.stream.StreamSupport;
import java.util.function.IntConsumer;
import java.util.function.LongConsumer;
import java.util.function.DoubleConsumer;

public class $JavaWiz {
    /*
     * Stream executions
     *
     * StreamViz draws each run of a stream pipeline as one execution. activeStreamFrames holds the executions that are
     * running right now. The top one is active, and the debugger records every traced event in it.
     *
     * Most streams run where they are written: their terminal operation (sum, count, toList, ...) consumes them before
     * the surrounding code continues. This also holds for a stream inside a callback of another stream, such as a
     * sorted comparator or a filter predicate: it starts and finishes within one call of that callback. For these
     * streams, the first source element opens the execution (StreamSourceTracer), and the terminal operation closes it
     * (complete). If another stream is running when the execution opens, the new execution becomes its child.
     *
     * Two kinds of streams have no terminal operation in the user's code, so they need their own boundary:
     * - A flatMap mapper returns a stream that has not run yet. flatMap runs it after the mapper returns, and each of
     *   its elements continues through the calling stream's next operations. The flatMap wrappers open the child's
     *   execution, switch to the calling stream while an element travels on, and close the child when it is exhausted.
     * - A Collectors.flatMapping mapper also returns a stream that has not run yet, and the collector consumes it
     *   internally. Instrumentation wraps this mapper with the flatMap wrapper, so it gets the same handling.
     *   The collector wrappers also close any other stream that a collector function leaves open.
     *
     * Streams without elements, such as a stream over an empty list, never call their source tracer, so they open no
     * execution. The same holds for a sized stream that count() answers from its size without running the pipeline.
     * - With a terminal operation, the terminal creates the execution, which then shows only the terminal lane.
     * - A flatMap or Collectors.flatMapping child is opened before it runs, so an empty child is shown too.
     * - Any other stream without a terminal operation produces no event at all and is not shown.
     */
    private static int nextStreamExecutionId = 0;
    private static final ArrayDeque<RuntimeStreamFrame> activeStreamFrames = new ArrayDeque<>();
    public static int activeStreamExecutionId = 0;
    public static int completedStreamExecutionId = 0;
    public static boolean completedStreamHadStart = false;
    public static String completedOperationName = "";
    public static int completedOperationId = -1;
    public static String completedOperationParameter = "";
    public static String completedResultText = "";
    /** The value returned by the most recently completed stream terminal operation; the debugger reads the result of collect from it. */
    public static Object latestCompletedStreamResult = null;
    public static int exhaustedChildExecutionId = 0;

    private static final class RuntimeStreamFrame {
        final int id;
        boolean sawStart;

        RuntimeStreamFrame(int id) {
            this.id = id;
        }
    }

    /**
     * Traces the elements of one stream source. Each evaluation of an instrumented source expression creates its own
     * tracer, so StreamViz can tell the next element of a running stream from the first element of a new stream that a
     * callback created, for example a stream inside a sorted comparator. It implements all four consumer types so that
     * one {@code .peek(...)} fits Stream, IntStream, LongStream, and DoubleStream.
     */
    public static final class StreamSourceTracer implements Consumer<Object>, IntConsumer, LongConsumer, DoubleConsumer {
        private final String operationName;
        private final int operationId;
        private final String operationParameter;
        /** The execution of this source; {@code null} until its first element. */
        private RuntimeStreamFrame frame;

        private StreamSourceTracer(String operationName, int operationId, String operationParameter) {
            this.operationName = operationName;
            this.operationId = operationId;
            this.operationParameter = operationParameter;
        }

        @Override
        public void accept(Object element) {
            enterSourceFrame(this);
            traceStream("START", element, operationName, operationId, operationParameter);
        }

        @Override
        public void accept(int element) {
            enterSourceFrame(this);
            traceStream("START", element, operationName, operationId, operationParameter);
        }

        @Override
        public void accept(long element) {
            enterSourceFrame(this);
            traceStream("START", element, operationName, operationId, operationParameter);
        }

        @Override
        public void accept(double element) {
            enterSourceFrame(this);
            traceStream("START", element, operationName, operationId, operationParameter);
        }
    }

    /**
     * Creates the tracer for one evaluation of an instrumented stream source.
     * Instrumentation appends it as {@code .peek($JavaWiz.traceStreamSource("of", 0, "1, 2"))}.
     */
    public static StreamSourceTracer traceStreamSource(String operationName, int operationId, String operationParameter) {
        return new StreamSourceTracer(operationName, operationId, operationParameter);
    }

    /**
     * Makes the execution of the tracer's source active before its element is traced.
     * The first element of a source opens a new execution. If another stream is running at that moment, the source
     * was created inside one of its callbacks, and the debugger records the new execution as a child of the running one.
     * A flatMap wrapper pushes the child's frame before the child produces elements; that frame is adopted instead.
     * Only flatMap pushes a frame before its first element, so no other frame is ever adopted.
     */
    private static void enterSourceFrame(StreamSourceTracer tracer) {
        if (tracer.frame == null) {
            RuntimeStreamFrame top = activeStreamFrames.peek();
            if (top != null && !top.sawStart) {
                tracer.frame = top;
            } else {
                tracer.frame = new RuntimeStreamFrame(++nextStreamExecutionId);
                activeStreamFrames.push(tracer.frame);
            }
        } else if (activeStreamFrames.contains(tracer.frame)) {
            // Frames above this source belong to streams that a callback created but never finished with a terminal
            // operation, for example map(p -> p.grades().stream().iterator().next()). Close them so the next element
            // of this source is not recorded in one of them.
            while (activeStreamFrames.peek() != tracer.frame) {
                activeStreamFrames.pop();
            }
        }
        tracer.frame.sawStart = true;
        activeStreamExecutionId = tracer.frame.id;
    }

    /**
     * Closes the executions that were opened above the given stack depth and makes the frame at that depth active again.
     * A collector function may create a stream and leave it open without an instrumented terminal operation, so the
     * collector wrappers close such streams before they trace the collect state of the calling stream. A stream without
     * elements opened no execution, so it is not closed or shown here. Streams returned by a
     * {@code Collectors.flatMapping} mapper are already closed by their wrapper (see {@link #wrapFlatMappingMapper}).
     */
    private static void endUnfinishedChildStreams(int depth) {
        while (activeStreamFrames.size() > depth) {
            activeStreamFrames.pop();
        }
        activeStreamExecutionId = activeStreamFrames.isEmpty() ? 0 : activeStreamFrames.peek().id;
    }

    /**
     * Returns the number of open stream executions. Instrumentation passes it as the first argument of the terminal
     * wrappers, so Java evaluates it before the terminal operation runs; see {@link #complete}.
     */
    public static int streamFrameDepth() {
        return activeStreamFrames.size();
    }

    /**
     * Closes the execution of a terminal operation. Only frames opened while the terminal expression ran (above
     * {@code frameDepth}) belong to its stream; the lowest of them is the stream itself, any higher ones are callback
     * streams that never reached a terminal operation. If no frame was opened, the stream produced no element, for
     * example {@code Stream.of(a, b).count()}, which Java answers from the known size, or a stream over an empty list.
     * It then gets a new execution, so the frame of a calling stream stays open.
     */
    private static void complete(int frameDepth, String operationName, int operationId, String operationParameter, String resultText) {
        RuntimeStreamFrame completed = null;
        while (activeStreamFrames.size() > frameDepth) {
            completed = activeStreamFrames.pop();
        }
        if (completed == null) {
            completed = new RuntimeStreamFrame(++nextStreamExecutionId);
        }
        completedStreamExecutionId = completed.id;
        completedStreamHadStart = completed.sawStart;
        completedOperationName = operationName;
        completedOperationId = operationId;
        completedOperationParameter = operationParameter;
        completedResultText = resultText == null ? "null" : resultText;
        activeStreamExecutionId = activeStreamFrames.isEmpty() ? 0 : activeStreamFrames.peek().id;
    }

    public static <T> T completeStreamVisualization(int frameDepth, String operationName, int operationId, String operationParameter, T value) {
        latestCompletedStreamResult = value;
        complete(frameDepth, operationName, operationId, operationParameter, completionText(value));
        return value;
    }

    /**
     * Runs a void terminal operation such as forEach and then completes its stream visualization.
     * This must not be an overload of completeStreamVisualization: javac would then also consider
     * Runnable while inferring the result type of value-returning terminals, and calls like
     * collect(Collectors.toCollection(ArrayList::new)) would no longer compile.
     */
    public static void completeVoidStreamVisualization(int frameDepth, String operationName, int operationId, String operationParameter, Runnable terminal) {
        terminal.run();
        latestCompletedStreamResult = null;
        complete(frameDepth, operationName, operationId, operationParameter, "forEach");
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

    /**
     * Wraps a flatMap mapper so that each stream it returns becomes a child execution of the calling stream.
     * Unlike a stream inside other callbacks, the returned stream has not run yet and has no terminal operation:
     * flatMap runs it after the mapper returns and passes each element on to the calling stream's next operations.
     * The wrapper therefore
     * - opens the child's execution before the child produces its first element, so an empty child is shown too
     *   (StreamSourceTracer adopts this frame for the child's source);
     * - makes the calling stream active while an element travels through the calling stream's next operations, and
     *   the child active again afterwards;
     * - closes the child when it is exhausted (endNestedFlatmapStream).
     * A mapper may return {@code null}, which flatMap treats as an empty stream; the wrapper passes it on unchanged and
     * records no child for it. The primitive variants below work the same way.
     */
    public static <T, R> Function<T, Stream<R>> wrapFlatMapMapper(
            int operationId,
            Function<? super T, ? extends Stream<? extends R>> mapper
    ) {
        return value -> {
            int parentId = activeStreamExecutionId;
            Stream<? extends R> child = mapper.apply(value);
            if (child == null) return null;
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

    /**
     * Wraps the mapper of {@code Collectors.flatMapping}. Like a flatMap mapper, it returns a stream that has not run
     * yet and that the collector consumes without a terminal operation, so it gets the same child handling, and empty
     * streams are shown too. Instrumentation rewrites
     * {@code Collectors.flatMapping(n -> Stream.of(n, -n), toList())} to
     * {@code Collectors.flatMapping($JavaWiz.wrapFlatMappingMapper(n -> Stream.of(n, -n)), toList())}.
     * Collectors.flatMapping has no primitive variants.
     */
    public static <T, R> Function<T, Stream<R>> wrapFlatMappingMapper(Function<? super T, ? extends Stream<? extends R>> mapper) {
        // The operation ID is not used by the flatMap wrapper, and a collector function has none.
        return wrapFlatMapMapper(0, mapper);
    }

    public static IntFunction<IntStream> wrapFlatMapToIntMapper(
            int operationId,
            IntFunction<? extends IntStream> mapper
    ) {
        return value -> {
            int parentId = activeStreamExecutionId;
            IntStream child = mapper.apply(value);
            if (child == null) return null;
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
            if (child == null) return null;
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
            if (child == null) return null;
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

    /**
     * Closes the execution of an exhausted flatMap or Collectors.flatMapping child, and the debugger records it even if
     * it produced no element. Only these children need this explicit end, because they have no terminal operation in
     * the user's code. Other streams end with their terminal operation or in the collector wrappers (see the overview
     * at the top).
     */
    public static void endNestedFlatmapStream() {
        if (activeStreamFrames.size() > 1) {
            RuntimeStreamFrame child = activeStreamFrames.pop();
            exhaustedChildExecutionId = child.id;
            activeStreamExecutionId = activeStreamFrames.peek().id;
        }
    }

    public static void traceStream(String eventKind, Object element, String operationName, int operationId, String operationParameter) {}
    public static void traceStream(String eventKind, Object element, String operationName, int operationId, String operationParameter, String terminalResultText) {}
    public static void traceStream(String eventKind, String element, String operationName, int operationId, String operationParameter) {}
    public static void traceStream(String eventKind, int element, String operationName, int operationId, String operationParameter) {}
    public static void traceStream(String eventKind, long element, String operationName, int operationId, String operationParameter) {}
    public static void traceStream(String eventKind, double element, String operationName, int operationId, String operationParameter) {}
    public static void traceStream(String eventKind, float element, String operationName, int operationId, String operationParameter) {}
    public static void traceStream(String eventKind, char element, String operationName, int operationId, String operationParameter) {}
    public static void traceStream(String eventKind, byte element, String operationName, int operationId, String operationParameter) {}
    public static void traceStream(String eventKind, short element, String operationName, int operationId, String operationParameter) {}
    public static void traceStream(String eventKind, boolean element, String operationName, int operationId, String operationParameter) {}
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

    /**
     * Wraps a collector so that StreamViz sees the accumulator state after every element.
     * Each call is traced, even when the state did not change (for example a rejected element in
     * Collectors.filtering), so every element that reached collect is linked to the collect marble.
     */
    public static <T, A, R> Collector<T, A, R> traceParam(
            String operationName,
            int operationId,
            String operationParameter,
            Collector<T, A, R> base
    ) {
        BiConsumer<A, T> accumulator = base.accumulator();
        return Collector.of(
                base.supplier(),
                (acc, t) -> {
                    int frameDepth = activeStreamFrames.size();
                    accumulator.accept(acc, t);
                    endUnfinishedChildStreams(frameDepth);
                    traceStream("END", acc, operationName, operationId, operationParameter, acc.toString());
                },
                base.combiner(),
                base.finisher(),
                base.characteristics().toArray(new Collector.Characteristics[0])
        );
    }

    /*
     * Accumulator wrappers for the three-argument collect(supplier, accumulator, combiner) of each stream type.
     * They trace the container after every element, like the Collector wrapper above. They need distinct
     * names: as overloads, javac cannot choose between them for method references such as ArrayList::add.
     */

    public static <R, T> BiConsumer<R, T> traceCollectAccumulator(String operationName, int operationId, String operationParameter, BiConsumer<R, ? super T> accumulator) {
        return (acc, t) -> {
            int frameDepth = activeStreamFrames.size();
            accumulator.accept(acc, t);
            endUnfinishedChildStreams(frameDepth);
            traceStream("END", acc, operationName, operationId, operationParameter, acc.toString());
        };
    }
    public static <R> ObjIntConsumer<R> traceIntCollectAccumulator(String operationName, int operationId, String operationParameter, ObjIntConsumer<R> accumulator) {
        return (acc, t) -> {
            int frameDepth = activeStreamFrames.size();
            accumulator.accept(acc, t);
            endUnfinishedChildStreams(frameDepth);
            traceStream("END", acc, operationName, operationId, operationParameter, acc.toString());
        };
    }
    public static <R> ObjLongConsumer<R> traceLongCollectAccumulator(String operationName, int operationId, String operationParameter, ObjLongConsumer<R> accumulator) {
        return (acc, t) -> {
            int frameDepth = activeStreamFrames.size();
            accumulator.accept(acc, t);
            endUnfinishedChildStreams(frameDepth);
            traceStream("END", acc, operationName, operationId, operationParameter, acc.toString());
        };
    }
    public static <R> ObjDoubleConsumer<R> traceDoubleCollectAccumulator(String operationName, int operationId, String operationParameter, ObjDoubleConsumer<R> accumulator) {
        return (acc, t) -> {
            int frameDepth = activeStreamFrames.size();
            accumulator.accept(acc, t);
            endUnfinishedChildStreams(frameDepth);
            traceStream("END", acc, operationName, operationId, operationParameter, acc.toString());
        };
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

    public static void rebuildStreamVisualization() {}

    /*
     * Standard input tracking
     *
     * When the program sends no debugger event for a while, the debugger cannot tell from the outside whether it waits
     * for keyboard input or runs a long call, such as Thread.sleep or the first String.format, which loads locale
     * data. To tell them apart, the main class calls trackStandardInput() from its first field initializer, before
     * any user code runs. It replaces System.in with a wrapper that sets readingStandardInput while a read is in
     * progress. The debugger reads both fields while the program runs.
     */
    /** Whether System.in has been replaced by the tracking wrapper. Until then, the debugger cannot rely on readingStandardInput. */
    public static volatile boolean standardInputTracked = false;
    /** Whether a read from System.in is in progress. A read that is still in progress after a second is blocked waiting for input. */
    public static volatile boolean readingStandardInput = false;

    /**
     * Replaces System.in with the tracking wrapper. Calling it again has no effect, so every main class of a program may
     * call it. It returns a value so that it can initialize a field: unlike static blocks, fields are allowed in
     * compact source files.
     */
    public static boolean trackStandardInput() {
        if (!standardInputTracked) {
            System.setIn(new StandardInputTracker(System.in));
            standardInputTracked = true;
        }
        return true;
    }

    /**
     * Passes all reads on to the original System.in and sets readingStandardInput while they run. The other read
     * methods of FilterInputStream and InputStream delegate to these two. This is a nested class on purpose: the
     * debugger observes the methods of $JavaWiz itself, and reads must not trigger these observations.
     */
    private static final class StandardInputTracker extends java.io.FilterInputStream {
        StandardInputTracker(java.io.InputStream in) {
            super(in);
        }

        @Override
        public int read() throws java.io.IOException {
            readingStandardInput = true;
            try {
                return super.read();
            } finally {
                readingStandardInput = false;
            }
        }

        @Override
        public int read(byte[] b, int off, int len) throws java.io.IOException {
            readingStandardInput = true;
            try {
                return super.read(b, off, len);
            } finally {
                readingStandardInput = false;
            }
        }
    }
}
